import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createDueReminderScanHandler } from '../src/jobs/handlers/dueReminderScan.js';
import { createSendNotificationHandler } from '../src/jobs/handlers/sendNotification.js';
import { startRecovery } from '../src/jobs/scheduler.js';
import { claim } from '../src/jobs/queue.js';

const FIXED_NOW = new Date('2026-09-29T12:00:00.000Z');
const FIXED_TODAY = '2026-09-29';
const FIXED_TOMORROW = '2026-09-30';
const FIXED_YESTERDAY = '2026-09-28';

let db;
let ownerId;
let assigneeId;
let projectId;
let storyId;

function insertTask({ title, dueDate, status = 'todo', assignee = assigneeId }) {
  const result = db.prepare(`
    INSERT INTO tasks (story_id, title, due_date, status, assignee_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(storyId, title, dueDate, status, assignee);
  return Number(result.lastInsertRowid);
}

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
  ownerId = Number(db.prepare(`
    INSERT INTO users (email, name, password_hash)
    VALUES ('owner@reminders.test', 'Owner', 'hash')
  `).run().lastInsertRowid);
  assigneeId = Number(db.prepare(`
    INSERT INTO users (email, name, password_hash)
    VALUES ('assignee@reminders.test', 'Assignee', 'hash')
  `).run().lastInsertRowid);
  projectId = Number(db.prepare(`
    INSERT INTO projects (name, owner_id) VALUES ('Reminder project', ?)
  `).run(ownerId).lastInsertRowid);
  db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, 'owner'), (?, ?, 'member')
  `).run(projectId, ownerId, projectId, assigneeId);
  storyId = Number(db.prepare(`
    INSERT INTO user_stories (project_id, title) VALUES (?, 'Reminder story')
  `).run(projectId).lastInsertRowid);
});

afterEach(() => db.close());

describe('due-date reminder scan', () => {
  it('enqueues a due-soon reminder for an assigned task due tomorrow', () => {
    const taskId = insertTask({ title: 'Tomorrow task', dueDate: FIXED_TOMORROW });
    const scan = createDueReminderScanHandler({ now: () => FIXED_NOW });

    expect(scan(db)).toMatchObject({ scanned: 1, enqueued: 1, utcDate: FIXED_TODAY });
    const job = db.prepare('SELECT type, payload, idempotency_key FROM jobs').get();
    expect(job.type).toBe('send_notification');
    expect(JSON.parse(job.payload)).toEqual({
      kind: 'task_due_soon',
      recipientId: assigneeId,
      taskId,
      taskTitle: 'Tomorrow task',
      storyTitle: 'Reminder story',
      projectId,
      projectName: 'Reminder project',
      dueDate: FIXED_TOMORROW,
    });
    expect(job.idempotency_key).toBe(`due_soon-task-${taskId}-${FIXED_TODAY}`);
  });

  it('enqueues an overdue reminder for an assigned task due yesterday', () => {
    const taskId = insertTask({ title: 'Overdue task', dueDate: FIXED_YESTERDAY });
    const scan = createDueReminderScanHandler({ now: () => FIXED_NOW });

    expect(scan(db)).toMatchObject({ scanned: 1, enqueued: 1 });
    const job = db.prepare('SELECT payload, idempotency_key FROM jobs').get();
    expect(JSON.parse(job.payload)).toMatchObject({
      kind: 'task_overdue',
      recipientId: assigneeId,
      taskId,
      dueDate: FIXED_YESTERDAY,
    });
    expect(job.idempotency_key).toBe(`overdue-task-${taskId}-${FIXED_TODAY}`);
  });

  it('excludes done tasks and tasks without an assignee', () => {
    insertTask({
      title: 'Done task',
      dueDate: FIXED_TOMORROW,
      status: 'done',
    });
    insertTask({
      title: 'Unassigned task',
      dueDate: FIXED_YESTERDAY,
      assignee: null,
    });
    const scan = createDueReminderScanHandler({ now: () => FIXED_NOW });

    expect(scan(db)).toMatchObject({ scanned: 0, enqueued: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count).toBe(0);
  });

  it('deduplicates repeated scans for the same UTC date', () => {
    const taskId = insertTask({ title: 'Repeat task', dueDate: FIXED_TOMORROW });
    const scan = createDueReminderScanHandler({ now: () => FIXED_NOW });

    expect(scan(db).enqueued).toBe(1);
    expect(scan(db).enqueued).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count).toBe(1);
    expect(db.prepare('SELECT idempotency_key FROM jobs').get().idempotency_key)
      .toBe(`due_soon-task-${taskId}-${FIXED_TODAY}`);
  });

  it('uses the existing notification handler to notify the assignee', () => {
    insertTask({ title: 'Tomorrow task', dueDate: FIXED_TOMORROW });
    const scan = createDueReminderScanHandler({ now: () => FIXED_NOW });
    scan(db);
    const job = claim(db, 'reminder-worker', { now: () => FIXED_NOW });
    const handler = createSendNotificationHandler({ failureRate: 0 });

    handler(db, job.payload, job);

    expect(db.prepare(`
      SELECT user_id, type, payload, idempotency_key FROM notifications
    `).get()).toMatchObject({
      user_id: assigneeId,
      type: 'task_due_soon',
      idempotency_key: job.idempotency_key,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?')
      .get(ownerId).count).toBe(0);
  });

  it('enqueues a scan immediately and on each configured scheduler interval', () => {
    const callbacks = [];
    const scanIntervalMs = 15 * 60 * 1000;
    const stop = startRecovery(db, {
      lockTimeoutMs: 60_000,
      intervalMs: 1000,
      reminderScanMs: scanIntervalMs,
      now: () => FIXED_NOW,
      setIntervalFn: (callback, delay) => {
        callbacks.push({ callback, delay });
        return callbacks.length;
      },
      clearIntervalFn() {},
    });

    const initialCount = db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count;
    expect(initialCount).toBe(1);
    const reminderTimer = callbacks.find(({ delay }) => delay === scanIntervalMs);
    expect(reminderTimer).toBeDefined();
    reminderTimer.callback();
    expect(db.prepare('SELECT COUNT(*) AS count FROM jobs').get().count).toBe(1);
    expect(db.prepare('SELECT type FROM jobs').get().type).toBe('due_reminder_scan');
    stop();
  });
});
