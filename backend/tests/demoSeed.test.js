import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createDemoSeedRepository } from '../src/repositories/demoSeedRepository.js';

let db;

beforeEach(() => {
  db = createConnection(':memory:');
  migrate(db);
});

afterEach(() => db.close());

describe('demo content seed', () => {
  it('creates the demo project once and leaves it unchanged on the next run', () => {
    const insertUser = db.prepare(`
      INSERT INTO users (email, name, password_hash) VALUES (?, ?, 'test-hash')
    `);
    const aliceId = Number(insertUser.run('alice@agile-tool.test', 'Alice').lastInsertRowid);
    const bobId = Number(insertUser.run('bob@agile-tool.test', 'Bob').lastInsertRowid);
    const charlieId = Number(insertUser.run('charlie@agile-tool.test', 'Charlie').lastInsertRowid);
    const repository = createDemoSeedRepository(db);

    const seed = () => db.transaction(() => {
      if (repository.demoProjectExists('alice@agile-tool.test')) return;
      repository.createDemoProject({ aliceId, bobId, charlieId });
    }).immediate();

    seed();
    const firstCounts = {
      projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get().count,
      members: db.prepare('SELECT COUNT(*) AS count FROM project_members').get().count,
      stories: db.prepare('SELECT COUNT(*) AS count FROM user_stories').get().count,
      tasks: db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count,
    };
    seed();
    const secondCounts = {
      projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get().count,
      members: db.prepare('SELECT COUNT(*) AS count FROM project_members').get().count,
      stories: db.prepare('SELECT COUNT(*) AS count FROM user_stories').get().count,
      tasks: db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count,
    };

    expect(repository.demoProjectExists('alice@agile-tool.test')).toBe(true);
    expect(firstCounts).toEqual({ projects: 1, members: 3, stories: 3, tasks: 7 });
    expect(secondCounts).toEqual(firstCounts);
    expect(db.prepare(`
      SELECT COUNT(*) AS count FROM tasks
      WHERE due_date < strftime('%Y-%m-%d', 'now')
    `).get().count).toBeGreaterThanOrEqual(1);
  });
});
