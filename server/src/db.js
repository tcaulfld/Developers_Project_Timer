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
  // Base tables only — never reference columns that older volumes lack.
  // work_label is added idempotently in ensureSessionsWorkLabel() after this.
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
      type TEXT NOT NULL CHECK (type IN ('Epic', 'Feature', 'User Story', 'Task', 'Other')),
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

  migrateSchemaVersion(db);
}

function setSchemaVersion(db, version) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(version));
}

function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

/**
 * Idempotent: add sessions.work_label + index on existing Docker volumes
 * and on fresh DBs whose CREATE TABLE omitted the column (base schema above).
 * Safe to run every boot; never assumes the column already exists.
 */
function ensureSessionsWorkLabel(db) {
  if (!hasColumn(db, 'sessions', 'work_label')) {
    // User Story session taxonomy (TD|Development|UTS|Review|Release); NULL otherwise.
    // Indexed for later productivity rollups by story+label.
    db.exec(`
      ALTER TABLE sessions ADD COLUMN work_label TEXT
        CHECK (work_label IS NULL OR work_label IN ('TD', 'Development', 'UTS', 'Review', 'Release'));
    `);
  }
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_sessions_work_label ON sessions(timer_id, work_label)`,
  );
}

/** Incremental SQLite migrations (CHECK changes need rebuilds; columns use ALTER). */
function migrateSchemaVersion(db) {
  const ver = db.prepare(`SELECT value FROM settings WHERE key = 'schema_version'`).get();
  let current = ver ? Number(ver.value) : 1;

  if (current < 2) {
    const rebuild = db.transaction(() => {
      // Parent DROP would fail while sessions FK points at timers.
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE timers_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT NOT NULL,
          project_number TEXT,
          description TEXT,
          type TEXT NOT NULL CHECK (type IN ('Epic', 'Feature', 'User Story', 'Task', 'Other')),
          epic_id INTEGER,
          bucket TEXT NOT NULL CHECK (bucket IN ('closed', 'open', 'future')) DEFAULT 'open',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO timers_v2 (id, label, project_number, description, type, epic_id, bucket, created_at, updated_at)
          SELECT id, label, project_number, description, type, epic_id, bucket, created_at, updated_at FROM timers;
        DROP TABLE timers;
        ALTER TABLE timers_v2 RENAME TO timers;
        CREATE INDEX IF NOT EXISTS idx_timers_bucket ON timers(bucket);
      `);
      setSchemaVersion(db, 2);
      db.pragma('foreign_keys = ON');
    });
    rebuild();
    current = 2;
  }

  // v3: work_label — always ensure column/index first (idempotent), then bump version.
  ensureSessionsWorkLabel(db);
  if (current < 3) {
    setSchemaVersion(db, 3);
  }
}
