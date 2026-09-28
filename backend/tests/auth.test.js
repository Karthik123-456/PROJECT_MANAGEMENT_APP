import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { requireAdmin } from '../src/middleware/requireAdmin.js';
import { env } from '../src/config/env.js';

let db;
let app;

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
  app = createApp(db);
});

afterEach(() => {
  db.close();
});

describe('auth API', () => {
  it('checks the injected database in the health route', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('registers a normalized email and returns only the safe user projection', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: '  Ada.Example@Agile-Tool.Test  ',
        name: 'Ada Lovelace',
        password: 'CorrectHorse42!',
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: 'ada.example@agile-tool.test',
      name: 'Ada Lovelace',
      is_admin: false,
    });
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('created_at');
    expect(response.body.user).not.toHaveProperty('password_hash');
    expect(jwt.decode(response.body.token)).not.toHaveProperty('is_admin');
  });

  it('rejects duplicate emails, including concurrent unique-constraint races', async () => {
    const payload = {
      email: 'race@agile-tool.test',
      name: 'Race User',
      password: 'CorrectHorse42!',
    };

    const responses = await Promise.all([
      request(app).post('/api/v1/auth/register').send(payload),
      request(app).post('/api/v1/auth/register').send(payload),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(responses.find(({ status }) => status === 409).body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects unknown fields and passwords over the bcrypt byte limit', async () => {
    const unknownField = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'unknown@agile-tool.test',
        name: 'Unknown',
        password: 'CorrectHorse42!',
        is_admin: true,
      });
    const tooManyBytes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'unicode@agile-tool.test',
        name: 'Unicode',
        password: '😀'.repeat(19),
      });
    const exactly72Bytes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'boundary@agile-tool.test',
        name: 'Boundary',
        password: 'a'.repeat(72),
      });

    expect(unknownField.status).toBe(422);
    expect(tooManyBytes.status).toBe(422);
    expect(exactly72Bytes.status).toBe(201);
  });

  it('returns the same login error for unknown emails and incorrect passwords', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'known@agile-tool.test',
        name: 'Known User',
        password: 'CorrectHorse42!',
      });

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'known@agile-tool.test', password: 'WrongPassword1!' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@agile-tool.test', password: 'WrongPassword1!' });
    const shortNonemptyPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@agile-tool.test', password: 'x' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
    expect(shortNonemptyPassword.status).toBe(401);
  });

  it('authenticates login and returns the database user from /me', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'me@agile-tool.test',
        name: 'Me User',
        password: 'CorrectHorse42!',
      });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'me@agile-tool.test', password: 'CorrectHorse42!' });
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(login.status).toBe(200);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      email: 'me@agile-tool.test',
      is_admin: false,
    });
    expect(me.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects missing, malformed, expired, non-integer, and deleted-user tokens', async () => {
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'token@agile-tool.test',
        name: 'Token User',
        password: 'CorrectHorse42!',
      });
    const userId = jwt.decode(registered.body.token).sub;
    const expiredToken = jwt.sign({ sub: userId }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s',
    });
    const stringSubjectToken = jwt.sign({ sub: String(userId) }, env.JWT_SECRET, {
      algorithm: 'HS256',
    });
    const wrongAlgorithmToken = jwt.sign({ sub: userId }, env.JWT_SECRET, {
      algorithm: 'HS384',
    });

    db.close();
    db = createConnection(':memory:');
    migrate(db);
    app = createApp(db);

    const responses = await Promise.all([
      request(app).get('/api/v1/auth/me'),
      request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt'),
      request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expiredToken}`),
      request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${stringSubjectToken}`),
      request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${wrongAlgorithmToken}`),
      request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${registered.body.token}`),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(responses.every(({ body }) => body.error.code === 'UNAUTHENTICATED')).toBe(true);
  });

  it('ignores token admin claims and enforces the DB-derived admin projection', async () => {
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-admin@agile-tool.test',
        name: 'Not Admin',
        password: 'CorrectHorse42!',
      });
    const userId = jwt.decode(registered.body.token).sub;
    const forgedToken = jwt.sign({ sub: userId, is_admin: true }, env.JWT_SECRET, {
      algorithm: 'HS256',
    });
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forgedToken}`);
    const next = vi.fn();

    requireAdmin({ user: response.body.user }, {}, next);

    expect(response.body.user.is_admin).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
  });

  it('returns 429 on the 11th failed login when the limiter is explicitly enabled', async () => {
    app = createApp(db, { rateLimitEnabled: true });

    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'limited@agile-tool.test', password: 'WrongPassword1!' }),
      );
    }

    expect(responses.slice(0, 10).every(({ status }) => status === 401)).toBe(true);
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.error.code).toBe('RATE_LIMITED');
  });
});
