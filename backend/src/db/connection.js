import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../config/env.js';

export function createConnection(dbPath = env.DB_PATH) {
  const resolvedPath = dbPath === ':memory:' ? dbPath : path.resolve(dbPath);

  if (resolvedPath !== ':memory:') {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);

  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}