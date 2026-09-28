import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from './connection.js';
import { logger } from '../utils/logger.js';

const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));

export function migrate(db, directory = migrationsDirectory) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const filenames = readdirSync(directory)
    .filter((filename) => /^\d+.*\.sql$/.test(filename))
    .sort();

  const hasMigration = db.prepare(
    'SELECT 1 FROM schema_migrations WHERE filename = ?',
  );
  const recordMigration = db.prepare(
    'INSERT INTO schema_migrations (filename) VALUES (?)',
  );

  let applied = 0;
  for (const filename of filenames) {
    if (hasMigration.get(filename)) {
      continue;
    }

    const sql = readFileSync(path.join(directory, filename), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      recordMigration.run(filename);
    }).immediate();
    applied += 1;
  }

  return applied;
}

function runMigrations() {
  const db = createConnection();
  try {
    migrate(db);
    logger.info('Database migrations completed');
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runMigrations();
  } catch (error) {
    logger.fatal({ err: error }, 'Database migration failed');
    process.exitCode = 1;
  }
}