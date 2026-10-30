import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SQLite connection factory.
 * DATA_DIR is volume-friendly for Docker (default: ./data).
 * Swap this module later for Postgres without touching routes.
 */
export function openDatabase(dataDir = process.env.DATA_DIR || path.resolve('data')) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'timer.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    -- Extension point: future multi-user auth (salted password hashes only — never plaintext).
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      password_salt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      project_number TEXT,
      description TEXT,
      type TEXT NOT NULL CHECK (type IN ('Epic', 'Feature', 'User Story', 'Task')),
      epic_id INTEGER REFERENCES timers(id) ON DELETE SET NULL,
      bucket TEXT NOT NULL CHECK (bucket IN ('closed', 'open', 'future')) DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timer_id INTEGER NOT NULL REFERENCES timers(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_timers_bucket ON timers(bucket);
    CREATE INDEX IF NOT EXISTS idx_sessions_timer ON sessions(timer_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_range ON sessions(started_at, ended_at);
  `);

  const row = db.prepare(`SELECT value FROM settings WHERE key = 'allow_multiple_active'`).get();
  if (!row) {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('allow_multiple_active', 'false')`).run();
  }
}
