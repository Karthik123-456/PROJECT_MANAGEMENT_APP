import Database from 'better-sqlite3';

const db = new Database(process.env.DB_PATH ?? './data/app.db');

console.log(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
);
console.log(db.prepare('SELECT id, email, is_admin FROM users').all());
console.log(db.pragma('wal_checkpoint(TRUNCATE)'));
db.close();