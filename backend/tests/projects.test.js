import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';

let db;
let app;
let users;

function createUser(key, { name = key, email = `${key}@agile-tool.test` } = {}) {
  const result = db.prepare(`
    INSERT INTO users (email, name, password_hash)
    VALUES (?, ?, 'test-hash')
  `).run(email, name);
  return { id: Number(result.lastInsertRowid), name, email };
}

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, env.JWT_SECRET, { algorithm: 'HS256' });
}

function as(user, method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${tokenFor(user)}`);
}

async function createProject(owner, name = 'Team project') {
  const response = await as(owner, 'post', '/api/v1/projects')
    .send({ name });
  expect(response.status).toBe(201);
  return response.body.project;
}

async function addMember(owner, projectId, email, role) {
  return as(owner, 'post', `/api/v1/projects/${projectId}/members`)
    .send({ email, role });
}

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
  users = {
    alice: createUser('alice', { name: 'Alice Owner' }),
    bob: createUser('bob', { name: 'Bob Member' }),
    charlie: createUser('charlie', { name: 'Charlie Viewer' }),
    outsider: createUser('outsider', { name: 'Other User' }),
  };
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

describe('Phase 4a project access and API', () => {
  it('makes the creator an owner and only lists projects the caller belongs to', async () => {
    const created = await createProject(users.alice);
    db.prepare('INSERT INTO projects (name, owner_id) VALUES (?, ?)')
      .run('Bob project', users.bob.id);
    const bobProjectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(bobProjectId, users.bob.id, 'owner');

    const list = await as(users.alice, 'get', '/api/v1/projects');
    const members = await as(users.alice, 'get', `/api/v1/projects/${created.id}/members`);

    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
      data: [{ id: created.id, role: 'owner' }],
    });
    expect(members.body.data).toEqual([
      expect.objectContaining({
        id: users.alice.id,
        name: users.alice.name,
        email: users.alice.email,
        role: 'owner',
      }),
    ]);
    expect(members.body).toMatchObject({ total: 1, limit: 20, offset: 0 });
  });

  it('returns identical 404s to a non-member for missing and existing projects, members, and activity', async () => {
    const project = await createProject(users.alice);
    const existingResponses = await Promise.all([
      as(users.outsider, 'get', `/api/v1/projects/${project.id}`),
      as(users.outsider, 'get', `/api/v1/projects/${project.id}/members`),
      as(users.outsider, 'get', `/api/v1/projects/${project.id}/activity`),
    ]);
    const missingResponses = await Promise.all([
      as(users.outsider, 'get', '/api/v1/projects/99999'),
      as(users.outsider, 'get', '/api/v1/projects/99999/members'),
      as(users.outsider, 'get', '/api/v1/projects/99999/activity'),
    ]);

    for (let index = 0; index < existingResponses.length; index += 1) {
      expect(existingResponses[index].status).toBe(404);
      expect(existingResponses[index].body.error.code).toBe('NOT_FOUND');
      expect(existingResponses[index].body).toEqual(missingResponses[index].body);
    }
  });

  it('rejects viewer writes and member owner-only actions while allowing member reads', async () => {
    const project = await createProject(users.alice);
    expect((await addMember(users.alice, project.id, users.bob.email, 'member')).status).toBe(201);
    expect((await addMember(users.alice, project.id, users.charlie.email, 'viewer')).status).toBe(201);

    const viewerWrite = await as(users.charlie, 'patch', `/api/v1/projects/${project.id}`)
      .send({ name: 'No access' });
    const memberOwnerAction = await as(users.bob, 'delete', `/api/v1/projects/${project.id}`);
    const memberRead = await as(users.bob, 'get', `/api/v1/projects/${project.id}`);

    expect(viewerWrite.status).toBe(403);
    expect(memberOwnerAction.status).toBe(403);
    expect(memberRead.status).toBe(200);
  });

  it('archives, rejects writes while archived, and lets the owner restore', async () => {
    const project = await createProject(users.alice);
    const archived = await as(users.alice, 'delete', `/api/v1/projects/${project.id}`);
    const activeList = await as(users.alice, 'get', '/api/v1/projects');
    const archivedList = await as(users.alice, 'get', '/api/v1/projects')
      .query({ status: 'archived' });
    const write = await as(users.alice, 'patch', `/api/v1/projects/${project.id}`)
      .send({ name: 'Archived edit' });
    const restore = await as(users.alice, 'post', `/api/v1/projects/${project.id}/restore`)
    const secondRestore = await as(users.alice, 'post', `/api/v1/projects/${project.id}/restore`)

    expect(archived.status).toBe(204);
    expect(archived.text).toBe('');
    expect(activeList.body.total).toBe(0);
    expect(archivedList.body.data[0]).toMatchObject({ id: project.id, role: 'owner' });
    expect(write.status).toBe(409);
    expect(write.body.error.code).toBe('PROJECT_ARCHIVED');
    expect(restore.status).toBe(200);
    expect(restore.body.project.archived_at).toBeNull();
    expect(secondRestore.status).toBe(409);
    expect(secondRestore.body.error.code).toBe('PROJECT_NOT_ARCHIVED');
  });

  it('prevents removing or demoting the owner and distinguishes unknown or duplicate members', async () => {
    const project = await createProject(users.alice);
    const unknown = await addMember(users.alice, project.id, 'unknown@agile-tool.test', 'member');
    const added = await addMember(users.alice, project.id, users.bob.email, 'member');
    const duplicate = await addMember(users.alice, project.id, users.bob.email, 'viewer');
    const demoteOwner = await as(users.alice, 'patch', `/api/v1/projects/${project.id}/members/${users.alice.id}`)
      .send({ role: 'viewer' });
    const removeOwner = await as(users.alice, 'delete', `/api/v1/projects/${project.id}/members/${users.alice.id}`);

    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('USER_NOT_FOUND');
    expect(added.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ALREADY_MEMBER');
    expect(demoteOwner.status).toBe(409);
    expect(removeOwner.status).toBe(409);
    expect(db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(project.id, users.alice.id).role).toBe('owner');
  });

  it('clears a removed member’s story and task assignments in the membership transaction', async () => {
    const project = await createProject(users.alice);
    await addMember(users.alice, project.id, users.bob.email, 'member');
    const storyId = Number(db.prepare(`
      INSERT INTO user_stories (project_id, title, assignee_id) VALUES (?, ?, ?)
    `).run(project.id, 'Assigned story', users.bob.id).lastInsertRowid);
    const taskId = Number(db.prepare(`
      INSERT INTO tasks (story_id, title, assignee_id) VALUES (?, ?, ?)
    `).run(storyId, 'Assigned task', users.bob.id).lastInsertRowid);

    const removed = await as(users.alice, 'delete', `/api/v1/projects/${project.id}/members/${users.bob.id}`);

    expect(removed.status).toBe(204);
    expect(db.prepare('SELECT assignee_id FROM user_stories WHERE id = ?').get(storyId).assignee_id)
      .toBeNull();
    expect(db.prepare('SELECT assignee_id FROM tasks WHERE id = ?').get(taskId).assignee_id)
      .toBeNull();
    expect(db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(project.id, users.bob.id)).toBeUndefined();
    expect(db.prepare(`
      SELECT action FROM activity_log WHERE project_id = ? ORDER BY id DESC LIMIT 1
    `).get(project.id).action).toBe('member.removed');
  });

  it('logs project mutations and returns paginated activity with actor names', async () => {
    const project = await createProject(users.alice);
    db.prepare("UPDATE projects SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?")
      .run(project.id);
    const update = await as(users.alice, 'patch', `/api/v1/projects/${project.id}`)
      .send({ name: 'Renamed project' });
    const activity = await as(users.alice, 'get', `/api/v1/projects/${project.id}/activity`)
      .query({ limit: 1, offset: 0 });

    expect(update.status).toBe(200);
    expect(update.body.project.name).toBe('Renamed project');
    expect(update.body.project.updated_at).not.toBe('2000-01-01T00:00:00.000Z');
    expect(activity.body).toMatchObject({ total: 2, limit: 1, offset: 0 });
    expect(activity.body.data[0]).toMatchObject({
      action: 'project.updated',
      actor_name: users.alice.name,
      meta: { changed_fields: ['name'] },
    });
    expect(activity.body.data[0]).not.toHaveProperty('password_hash');
  });

  it('rejects empty PATCH and unknown body or query fields', async () => {
    const project = await createProject(users.alice);
    const emptyPatch = await as(users.alice, 'patch', `/api/v1/projects/${project.id}`).send({});
    const extraField = await as(users.alice, 'patch', `/api/v1/projects/${project.id}`)
      .send({ name: 'Valid', is_admin: true });
    const extraQuery = await as(users.alice, 'get', '/api/v1/projects')
      .query({ unexpected: 'value' });

    expect(emptyPatch.status).toBe(422);
    expect(emptyPatch.body.error.code).toBe('VALIDATION_ERROR');
    expect(extraField.status).toBe(422);
    expect(extraQuery.status).toBe(422);
  });

  it('searches users with literal LIKE wildcards, bounded results, and safe projections', async () => {
    createUser('percent-literal', { name: '100% Match' });
    createUser('percent-wildcard', { name: '100X Match' });
    for (let index = 0; index < 25; index += 1) {
      createUser(`find-${index}`, { name: `Find Person ${index}` });
    }
    const literal = await as(users.alice, 'get', '/api/v1/users').query({ search: '100%' });
    const bounded = await as(users.alice, 'get', '/api/v1/users').query({ search: 'Find' });
    const tooShort = await as(users.alice, 'get', '/api/v1/users').query({ search: 'F' });

    expect(literal.body.data.map(({ name }) => name)).toEqual(['100% Match']);
    expect(bounded.body).toMatchObject({ total: 25, limit: 20, offset: 0 });
    expect(bounded.body.data).toHaveLength(20);
    expect(bounded.body.data[0]).toEqual(expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      email: expect.any(String),
    }));
    expect(bounded.body.data[0]).not.toHaveProperty('password_hash');
    expect(tooShort.status).toBe(422);
  });
});
