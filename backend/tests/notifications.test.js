import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';

let db;
let app;
let owner;
let member;
let admin;
let otherNotificationId;
let deadJobId;

function addUser(name, isAdmin = false) {
  const result = db.prepare(`
    INSERT INTO users (email, name, password_hash, is_admin)
    VALUES (?, ?, 'test-hash', ?)
  `).run(`${name.toLowerCase()}@notifications.test`, name, Number(isAdmin));
  return { id: Number(result.lastInsertRowid), name };
}

function requestAs(user, method, url) {
  const token = jwt.sign(
    { sub: user.id },
    env.JWT_SECRET,
    { algorithm: 'HS256' },
  );
  return request(app)[method](url).set('Authorization', `Bearer ${token}`);
}

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
  owner = addUser('Owner');
  member = addUser('Member');
  admin = addUser('Admin', true);
  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, type, payload, idempotency_key)
    VALUES (?, 'task_completed', ?, ?)
  `);
  insertNotification.run(owner.id, '{"taskTitle":"Owner task"}', 'owner-notification');
  otherNotificationId = Number(insertNotification.run(
    member.id,
    '{"taskTitle":"Member task"}',
    'member-notification',
  ).lastInsertRowid);
  deadJobId = Number(db.prepare(`
    INSERT INTO jobs (type, payload, status, attempts, max_attempts, idempotency_key)
    VALUES ('send_notification', '{}', 'dead', 5, 5, 'dead-job')
  `).run().lastInsertRowid);
  app = createApp(db);
});

afterEach(() => db.close());

describe('notifications and admin jobs endpoints', () => {
  it('lists only the caller’s notifications and supports unread filtering', async () => {
    const response = await requestAs(member, 'get', '/api/v1/notifications?unread=true');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, limit: 20, offset: 0 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: otherNotificationId,
      user_id: member.id,
      payload: { taskTitle: 'Member task' },
    });
  });

  it('returns 404 when a user marks another user’s notification as read', async () => {
    const response = await requestAs(owner, 'post', `/api/v1/notifications/${otherNotificationId}/read`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(db.prepare('SELECT read_at FROM notifications WHERE id = ?')
      .get(otherNotificationId).read_at).toBeNull();
  });

  it('marks only the caller’s own notifications as read', async () => {
    const response = await requestAs(member, 'post', '/api/v1/notifications/read-all');

    expect(response.status).toBe(200);
    expect(response.body.updated).toBe(1);
    expect(db.prepare('SELECT read_at FROM notifications WHERE id = ?')
      .get(otherNotificationId).read_at).not.toBeNull();
    expect(db.prepare('SELECT read_at FROM notifications WHERE user_id = ?')
      .get(owner.id).read_at).toBeNull();
  });

  it('requires an administrator to list and retry dead jobs', async () => {
    const forbidden = await requestAs(member, 'get', '/api/v1/admin/jobs?status=dead');
    expect(forbidden.status).toBe(403);

    const listed = await requestAs(admin, 'get', '/api/v1/admin/jobs?status=dead');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(deadJobId);

    const retried = await requestAs(admin, 'post', `/api/v1/admin/jobs/${deadJobId}/retry`);
    expect(retried.status).toBe(200);
    expect(retried.body.job).toMatchObject({
      id: deadJobId,
      status: 'pending',
      attempts: 0,
      locked_by: null,
      last_error: null,
    });
  });
});
