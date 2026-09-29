import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createStoryTaskRepository } from '../src/repositories/storyTaskRepository.js';
import { createStoryTaskService } from '../src/services/storyTaskService.js';
import { createSendNotificationHandler } from '../src/jobs/handlers/sendNotification.js';
import { claim, complete, enqueue, fail, recoverStuck } from '../src/jobs/queue.js';
import { processNextJob } from '../src/jobs/worker.js';

let db;
let owner;
let member;
let projectId;
let storyId;
let taskId;

function addUser(name, isAdmin = false) {
  const result = db.prepare(`
    INSERT INTO users (email, name, password_hash, is_admin)
    VALUES (?, ?, 'test-hash', ?)
  `).run(`${name.toLowerCase()}@jobs.test`, name, Number(isAdmin));
  return { id: Number(result.lastInsertRowid), name };
}

function createTask(title) {
  const result = db.prepare(`
    INSERT INTO tasks (story_id, title) VALUES (?, ?)
  `).run(storyId, title);
  return Number(result.lastInsertRowid);
}

function insertNotificationJob(idempotencyKey = 'test-notification') {
  return enqueue(db, {
    type: 'send_notification',
    payload: {
      kind: 'task_completed',
      projectId,
      projectName: 'Jobs project',
      storyId,
      storyTitle: 'A story',
      taskId,
      taskTitle: 'A task',
      completedBy: { id: member.id, name: member.name },
    },
    idempotencyKey,
    runAt: '2026-01-01T00:00:00.000Z',
  });
}

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
  owner = addUser('Owner');
  member = addUser('Member');
  const project = db.prepare(`
    INSERT INTO projects (name, owner_id) VALUES ('Jobs project', ?)
  `).run(owner.id);
  projectId = Number(project.lastInsertRowid);
  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, 'owner'), (?, ?, 'member')
  `).run(projectId, owner.id, projectId, member.id);
  const story = db.prepare(`
    INSERT INTO user_stories (project_id, title) VALUES (?, 'A story')
  `).run(projectId);
  storyId = Number(story.lastInsertRowid);
  taskId = createTask('A task');
});

afterEach(() => db.close());

describe('database-backed job queue', () => {
  it('rolls an enqueued job back with the caller transaction', () => {
    expect(() => db.transaction(() => {
      enqueue(db, {
        type: 'send_notification',
        payload: {},
        idempotencyKey: 'rollback-job',
      });
      throw new Error('rollback');
    }).immediate()).toThrow('rollback');

    expect(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count).toBe(0);
  });

  it('claims a job exclusively for one worker', () => {
    insertNotificationJob();
    const first = claim(db, 'worker-one', {
      now: () => new Date('2026-01-02T00:00:00.000Z'),
    });
    const second = claim(db, 'worker-two', {
      now: () => new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(first).toMatchObject({ status: 'running', locked_by: 'worker-one' });
    expect(second).toBeNull();
  });

  it('schedules exponential retry backoff and dead-letters after max attempts', () => {
    const id = insertNotificationJob('retry-job');
    db.prepare('UPDATE jobs SET max_attempts = 2 WHERE id = ?').run(id);
    const firstFailureAt = new Date('2026-01-02T00:00:00.000Z');
    const firstClaim = claim(db, 'worker', { now: () => firstFailureAt });

    expect(fail(
      db,
      firstClaim.id,
      'worker',
      new Error('first failure'),
      (job) => job.max_attempts,
      { now: () => firstFailureAt, random: () => 0 },
    )).toBe(true);
    expect(db.prepare('SELECT status, attempts, run_at FROM jobs WHERE id = ?').get(id))
      .toEqual({
        status: 'pending',
        attempts: 1,
        run_at: '2026-01-02T00:00:05.000Z',
      });

    const secondFailureAt = new Date('2026-01-02T00:00:06.000Z');
    const secondClaim = claim(db, 'worker', { now: () => secondFailureAt });
    expect(fail(
      db,
      secondClaim.id,
      'worker',
      new Error('second failure'),
      (job) => job.max_attempts,
      { now: () => secondFailureAt, random: () => 0 },
    )).toBe(true);
    expect(db.prepare('SELECT status, attempts, finished_at FROM jobs WHERE id = ?').get(id))
      .toMatchObject({ status: 'dead', attempts: 2 });
  });

  it('recovers a running job whose lock is older than the timeout', () => {
    const id = insertNotificationJob('stuck-job');
    claim(db, 'crashed-worker', {
      now: () => new Date('2026-01-02T00:02:00.000Z'),
    });
    db.prepare('UPDATE jobs SET locked_at = ? WHERE id = ?')
      .run('2026-01-02T00:00:00.000Z', id);

    expect(recoverStuck(db, 60_000, {
      now: () => new Date('2026-01-02T00:02:00.000Z'),
    })).toBe(1);
    expect(db.prepare('SELECT status, locked_by FROM jobs WHERE id = ?').get(id))
      .toEqual({ status: 'pending', locked_by: null });
  });

  it('does nothing when enqueue receives a duplicate idempotency key', () => {
    const firstId = insertNotificationJob('same-key');
    const duplicateId = insertNotificationJob('same-key');

    expect(firstId).toBeTypeOf('number');
    expect(duplicateId).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count).toBe(1);
  });

  it('enqueues task completion for a member but not when the owner completes it', () => {
    let suffix = 0;
    const service = createStoryTaskService(
      db,
      createStoryTaskRepository(db),
      { record() {} },
      {
        now: () => new Date('2026-09-29T00:00:00.000Z'),
        createEventSuffix: () => `event-${++suffix}`,
      },
    );

    service.updateTask({
      projectId,
      actorId: member.id,
      taskId,
      body: { status: 'done' },
    });

    const enqueued = db.prepare('SELECT type, payload, idempotency_key FROM jobs').get();
    expect(enqueued.type).toBe('send_notification');
    expect(JSON.parse(enqueued.payload)).toEqual({
      kind: 'task_completed',
      projectId,
      projectName: 'Jobs project',
      storyId,
      storyTitle: 'A story',
      taskId,
      taskTitle: 'A task',
      completedBy: { id: member.id, name: member.name },
    });
    expect(enqueued.idempotency_key).toContain('task-');

    service.updateTask({
      projectId,
      actorId: member.id,
      taskId,
      body: { status: 'in_progress' },
    });
    service.updateTask({
      projectId,
      actorId: member.id,
      taskId,
      body: { status: 'done' },
    });
    const taskEventKeys = db.prepare(`
      SELECT idempotency_key FROM jobs WHERE idempotency_key LIKE 'task-%'
    `).all().map(({ idempotency_key }) => idempotency_key);
    expect(taskEventKeys).toHaveLength(2);
    expect(new Set(taskEventKeys).size).toBe(2);

    const ownerTaskId = createTask('Owner task');
    service.updateTask({
      projectId,
      actorId: owner.id,
      taskId: ownerTaskId,
      body: { status: 'done' },
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count).toBe(2);
  });

  it('enqueues story completion for a member and skips the owner', () => {
    const secondStoryId = Number(db.prepare(`
      INSERT INTO user_stories (project_id, title) VALUES (?, 'Second story')
    `).run(projectId).lastInsertRowid);
    let suffix = 0;
    const service = createStoryTaskService(
      db,
      createStoryTaskRepository(db),
      { record() {} },
      { createEventSuffix: () => `event-${++suffix}` },
    );

    service.updateStory({
      projectId,
      actorId: member.id,
      storyId: secondStoryId,
      body: { status: 'done' },
    });
    const ownerStoryId = Number(db.prepare(`
      INSERT INTO user_stories (project_id, title) VALUES (?, 'Owner story')
    `).run(projectId).lastInsertRowid);
    service.updateStory({
      projectId,
      actorId: owner.id,
      storyId: ownerStoryId,
      body: { status: 'done' },
    });

    const jobs = db.prepare('SELECT payload FROM jobs').all();
    expect(jobs).toHaveLength(1);
    expect(JSON.parse(jobs[0].payload)).toMatchObject({
      kind: 'story_completed',
      storyId: secondStoryId,
      completedBy: { id: member.id, name: member.name },
    });
  });

  it('inserts one owner notification when the claimed send handler runs', () => {
    const id = insertNotificationJob('notification-once');
    const job = claim(db, 'worker', {
      now: () => new Date('2026-01-02T00:00:00.000Z'),
    });
    const handler = createSendNotificationHandler({ failureRate: 0 });

    handler(db, job.payload, job);
    handler(db, job.payload, job);
    const notification = db.prepare(`
      SELECT COUNT(*) AS count, MIN(idempotency_key) AS idempotency_key
      FROM notifications WHERE user_id = ?
    `).get(owner.id);
    expect(notification.count).toBe(1);
    expect(notification.idempotency_key).toBe(job.idempotency_key);
    expect(complete(db, id, 'worker', { notificationQueued: true })).toBe(true);
  });

  it('records a forced simulated email failure for retry instead of completing', async () => {
    insertNotificationJob('forced-email-failure');
    const handler = createSendNotificationHandler({
      failureRate: 1,
      random: () => 0,
    });

    await processNextJob({
      db,
      workerId: 'worker',
      jobHandlers: { send_notification: handler },
      now: () => new Date('2026-01-02T00:00:00.000Z'),
      random: () => 0,
    });

    const job = db.prepare('SELECT status, attempts, result FROM jobs').get();
    expect(job).toEqual({ status: 'pending', attempts: 1, result: null });
    expect(db.prepare('SELECT COUNT(*) AS count FROM notifications').get().count).toBe(0);
  });
});
