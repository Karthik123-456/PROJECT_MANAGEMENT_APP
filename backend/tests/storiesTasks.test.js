import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';

let db;
let app;
let people;

function createUser(name) {
  const result = db.prepare(`
    INSERT INTO users (email, name, password_hash) VALUES (?, ?, 'test-hash')
  `).run(`${name.toLowerCase()}@agile-tool.test`, name);
  return { id: Number(result.lastInsertRowid), name, email: `${name.toLowerCase()}@agile-tool.test` };
}

function requestAs(user, method, path) {
  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { algorithm: 'HS256' });
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

async function createProject(owner, name) {
  const response = await requestAs(owner, 'post', '/api/v1/projects').send({ name });
  expect(response.status).toBe(201);
  return response.body.project;
}

async function addProjectMember(owner, projectId, user, role = 'member') {
  const response = await requestAs(owner, 'post', `/api/v1/projects/${projectId}/members`)
    .send({ email: user.email, role });
  expect(response.status).toBe(201);
  return response.body.member;
}

async function createStory(user, projectId, payload = { title: 'Story' }) {
  const response = await requestAs(user, 'post', `/api/v1/projects/${projectId}/stories`)
    .send(payload);
  expect(response.status).toBe(201);
  return response.body.story;
}

async function createTask(user, storyId, payload = { title: 'Task' }) {
  const response = await requestAs(user, 'post', `/api/v1/stories/${storyId}/tasks`)
    .send(payload);
  expect(response.status).toBe(201);
  return response.body.task;
}

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
  people = {
    owner: createUser('Alice'),
    member: createUser('Bob'),
    viewer: createUser('Charlie'),
    outsider: createUser('Outsider'),
  };
  app = createApp(db);
});

afterEach(() => db.close());

describe('stories, tasks, and project tree API', () => {
  it('conceals stories and tasks outside the caller project', async () => {
    const projectA = await createProject(people.owner, 'Project A');
    await addProjectMember(people.owner, projectA.id, people.member);
    const projectB = await createProject(people.outsider, 'Project B');
    const story = await createStory(people.outsider, projectB.id);
    const task = await createTask(people.outsider, story.id);

    const [storyResponse, taskResponse, taskList] = await Promise.all([
      requestAs(people.member, 'get', `/api/v1/stories/${story.id}`),
      requestAs(people.member, 'get', `/api/v1/tasks/${task.id}`),
      requestAs(people.member, 'get', `/api/v1/stories/${story.id}/tasks`),
    ]);
    expect(storyResponse.status).toBe(404);
    expect(taskResponse.status).toBe(404);
    expect(taskList.status).toBe(404);
    expect(storyResponse.body.error).toEqual(taskResponse.body.error);
    expect(storyResponse.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('enforces role permissions and archived-project write rules', async () => {
    const project = await createProject(people.owner, 'Roles');
    await addProjectMember(people.owner, project.id, people.member);
    await addProjectMember(people.owner, project.id, people.viewer, 'viewer');
    const viewerRead = await requestAs(people.viewer, 'get', `/api/v1/projects/${project.id}/stories`);
    const viewerWrite = await requestAs(people.viewer, 'post', `/api/v1/projects/${project.id}/stories`)
      .send({ title: 'Denied' });
    const archived = await requestAs(people.owner, 'delete', `/api/v1/projects/${project.id}`);
    const memberWrite = await requestAs(people.member, 'post', `/api/v1/projects/${project.id}/stories`)
      .send({ title: 'Archived write' });

    expect(viewerRead.status).toBe(200);
    expect(viewerWrite.status).toBe(403);
    expect(archived.status).toBe(204);
    expect(memberWrite.status).toBe(409);
    expect(memberWrite.body.error.code).toBe('PROJECT_ARCHIVED');
  });

  it('rejects done stories with open tasks, allows empty stories, and allows reopening', async () => {
    const project = await createProject(people.owner, 'Story status');
    await addProjectMember(people.owner, project.id, people.member);
    const story = await createStory(people.member, project.id);
    await createTask(people.member, story.id);
    const blocked = await requestAs(people.member, 'patch', `/api/v1/stories/${story.id}`)
      .send({ status: 'done' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('STORY_HAS_OPEN_TASKS');

    const task = db.prepare("SELECT id FROM tasks WHERE story_id = ?").get(story.id);
    await requestAs(people.member, 'patch', `/api/v1/tasks/${task.id}`).send({ status: 'done' });
    const completed = await requestAs(people.member, 'patch', `/api/v1/stories/${story.id}`)
      .send({ status: 'done' });
    const reopened = await requestAs(people.member, 'patch', `/api/v1/stories/${story.id}`)
      .send({ status: 'backlog' });
    const emptyStory = await createStory(people.member, project.id, { title: 'No tasks' });
    const emptyCompleted = await requestAs(people.member, 'patch', `/api/v1/stories/${emptyStory.id}`)
      .send({ status: 'done' });

    expect(completed.status).toBe(200);
    expect(reopened.body.story.status).toBe('backlog');
    expect(emptyCompleted.body.story.status).toBe('done');
  });

  it('rejects tasks in done stories and validates assignees against project membership', async () => {
    const project = await createProject(people.owner, 'Assignees');
    await addProjectMember(people.owner, project.id, people.member);
    await addProjectMember(people.owner, project.id, people.viewer, 'viewer');
    const invalidStory = await requestAs(people.member, 'post', `/api/v1/projects/${project.id}/stories`)
      .send({ title: 'Outside assignee', assignee_id: people.outsider.id });
    const unassignedStory = await createStory(people.member, project.id);
    const invalidStoryPatch = await requestAs(people.member, 'patch', `/api/v1/stories/${unassignedStory.id}`)
      .send({ assignee_id: people.outsider.id });
    const story = await createStory(people.member, project.id, { title: 'Done', status: 'done' });
    const doneStoryTask = await requestAs(people.member, 'post', `/api/v1/stories/${story.id}/tasks`)
      .send({ title: 'Blocked task' });
    const unassigned = await createStory(people.member, project.id);
    const invalidAssignee = await requestAs(people.member, 'post', `/api/v1/stories/${unassigned.id}/tasks`)
      .send({ title: 'Outside assignment', assignee_id: people.outsider.id });
    const assignedViewer = await createTask(people.member, unassigned.id, {
      title: 'Viewer may be assigned',
      assignee_id: people.viewer.id,
    });
    const invalidPatchAssignee = await requestAs(people.member, 'patch', `/api/v1/tasks/${assignedViewer.id}`)
      .send({ assignee_id: people.outsider.id });

    expect(doneStoryTask.status).toBe(409);
    expect(doneStoryTask.body.error.code).toBe('STORY_DONE');
    expect(invalidStory.status).toBe(422);
    expect(invalidStoryPatch.status).toBe(422);
    expect(invalidAssignee.status).toBe(422);
    expect(invalidAssignee.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ['assignee_id'] }),
    ]));
    expect(assignedViewer.assignee).toEqual({
      id: people.viewer.id,
      name: people.viewer.name,
      email: people.viewer.email,
    });
    expect(invalidPatchAssignee.status).toBe(422);
  });

  it('prevents moving resources through PATCH and validates real dates', async () => {
    const project = await createProject(people.owner, 'No resource moves');
    await addProjectMember(people.owner, project.id, people.member);
    const story = await createStory(people.member, project.id);
    const task = await createTask(people.member, story.id);
    const storyMove = await requestAs(people.member, 'patch', `/api/v1/stories/${story.id}`)
      .send({ project_id: 900 });
    const taskMove = await requestAs(people.member, 'patch', `/api/v1/tasks/${task.id}`)
      .send({ story_id: 900 });
    const invalidDate = await requestAs(people.member, 'patch', `/api/v1/tasks/${task.id}`)
      .send({ due_date: '2026-02-30' });

    expect(storyMove.status).toBe(422);
    expect(taskMove.status).toBe(422);
    expect(invalidDate.status).toBe(422);
  });

  it('assigns monotonically increasing positions and returns tree progress and ordering', async () => {
    const project = await createProject(people.owner, 'Tree');
    await addProjectMember(people.owner, project.id, people.member);
    const first = await createStory(people.member, project.id, { title: 'First' });
    const second = await createStory(people.member, project.id, { title: 'Second' });
    const empty = await createStory(people.member, project.id, { title: 'Empty' });
    const firstTask1 = await createTask(people.member, first.id, { title: 'First task' });
    const firstTask2 = await createTask(people.member, first.id, { title: 'Second task' });
    await createTask(people.member, second.id, { title: 'Only task', status: 'done' });
    await requestAs(people.member, 'patch', `/api/v1/tasks/${firstTask1.id}`).send({ status: 'done' });

    const tree = await requestAs(people.member, 'get', `/api/v1/projects/${project.id}/tree`);
    expect(first.position).toBe(1000);
    expect(second.position).toBe(2000);
    expect(firstTask1.position).toBe(1000);
    expect(firstTask2.position).toBe(2000);
    expect(tree.status).toBe(200);
    expect(tree.body.project.id).toBe(project.id);
    expect(tree.body.stories.map(({ id }) => id)).toEqual([first.id, second.id, empty.id]);
    expect(tree.body.stories[0].progress).toEqual({
      done_tasks: 1,
      total_tasks: 2,
      percent: 50,
    });
    expect(tree.body.stories[1].progress).toEqual({
      done_tasks: 1,
      total_tasks: 1,
      percent: 100,
    });
    expect(tree.body.stories[2].progress).toEqual({
      done_tasks: 0,
      total_tasks: 0,
      percent: 0,
    });
    expect(tree.body.stories[0].tasks.map(({ id }) => id)).toEqual([firstTask1.id, firstTask2.id]);
  });

  it('returns assigned non-archived /me/tasks, filters overdue in UTC, and orders null dates last', async () => {
    const project = await createProject(people.owner, 'My tasks');
    await addProjectMember(people.owner, project.id, people.member);
    const story = await createStory(people.member, project.id);
    const nullDue = await createTask(people.member, story.id, {
      title: 'No due date',
      assignee_id: people.member.id,
    });
    const overdue = await createTask(people.member, story.id, {
      title: 'Overdue',
      assignee_id: people.member.id,
      due_date: '2000-01-01',
    });
    const completedOverdue = await createTask(people.member, story.id, {
      title: 'Completed overdue',
      assignee_id: people.member.id,
      due_date: '2000-01-02',
      status: 'done',
    });
    await createTask(people.member, story.id, { title: 'Not assigned' });
    const all = await requestAs(people.member, 'get', '/api/v1/me/tasks');
    const overdueOnly = await requestAs(people.member, 'get', '/api/v1/me/tasks')
      .query({ overdue: true });

    expect(all.body.data.map(({ id }) => id)).toEqual([
      overdue.id,
      completedOverdue.id,
      nullDue.id,
    ]);
    expect(all.body.data[0]).toMatchObject({
      story_title: story.title,
      project_name: project.name,
      assignee: { id: people.member.id },
    });
    expect(overdueOnly.body.data.map(({ id }) => id)).toEqual([overdue.id]);
    expect(overdueOnly.body.data[0].status).not.toBe('done');

    await requestAs(people.owner, 'delete', `/api/v1/projects/${project.id}`);
    const afterArchive = await requestAs(people.member, 'get', '/api/v1/me/tasks');
    expect(afterArchive.body.total).toBe(0);
  });

  it('cascades story deletion, logs titles/status changes, and clears removed-member assignments', async () => {
    const project = await createProject(people.owner, 'Delete story');
    await addProjectMember(people.owner, project.id, people.member);
    const story = await createStory(people.member, project.id, { title: 'Remove me' });
    const task = await createTask(people.member, story.id, {
      title: 'Remove task',
      assignee_id: people.member.id,
    });
    const changed = await requestAs(people.member, 'patch', `/api/v1/tasks/${task.id}`)
      .send({ status: 'in_progress' });
    const deleted = await requestAs(people.owner, 'delete', `/api/v1/stories/${story.id}`);
    const activities = await requestAs(people.owner, 'get', `/api/v1/projects/${project.id}/activity`);

    expect(changed.body.task.status).toBe('in_progress');
    expect(deleted.status).toBe(204);
    expect(db.prepare('SELECT id FROM tasks WHERE story_id = ?').all(story.id)).toHaveLength(0);
    expect(activities.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'task.updated',
        meta: expect.objectContaining({ old_status: 'todo', new_status: 'in_progress' }),
      }),
      expect.objectContaining({
        action: 'story.deleted',
        meta: { title: 'Remove me' },
      }),
    ]));

    const otherStory = await createStory(people.member, project.id, { title: 'Assignment cleanup' });
    const otherTask = await createTask(people.member, otherStory.id, {
      title: 'Assigned task',
      assignee_id: people.member.id,
    });
    await requestAs(people.owner, 'delete', `/api/v1/projects/${project.id}/members/${people.member.id}`);
    expect(db.prepare('SELECT assignee_id FROM tasks WHERE id = ?').get(otherTask.id).assignee_id)
      .toBeNull();
  });

  it('lets a member delete a task and records the deleted title', async () => {
    const project = await createProject(people.owner, 'Delete task');
    await addProjectMember(people.owner, project.id, people.member);
    const story = await createStory(people.member, project.id);
    const task = await createTask(people.member, story.id, { title: 'Delete task title' });
    const deleted = await requestAs(people.member, 'delete', `/api/v1/tasks/${task.id}`);
    const activity = db.prepare(`
      SELECT action, meta FROM activity_log
      WHERE project_id = ? AND entity_type = 'task' AND entity_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(project.id, task.id);

    expect(deleted.status).toBe(204);
    expect(db.prepare('SELECT id FROM tasks WHERE id = ?').get(task.id)).toBeUndefined();
    expect(activity.action).toBe('task.deleted');
    expect(JSON.parse(activity.meta)).toEqual({ title: 'Delete task title' });
  });
});
