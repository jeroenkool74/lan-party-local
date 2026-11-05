import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- One row per OpenRCT2 identity (public key hash). Names may change; the hash does not.
CREATE TABLE IF NOT EXISTS players (
  hash        TEXT PRIMARY KEY,
  pid         TEXT NOT NULL UNIQUE,      -- public id: first 16 hex chars of the hash
  name        TEXT NOT NULL,
  first_seen  INTEGER NOT NULL,          -- unix ms
  last_seen   INTEGER,                   -- unix ms, last snapshot in which the player was online
  group_name  TEXT,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  balance     INTEGER,                   -- ffa-individual-economy balance (raw money units)
  money_spent INTEGER
);
-- One row per attraction. OpenRCT2 reuses ride ids after demolition, so the
-- key also contains the build date and ride type.
CREATE TABLE IF NOT EXISTS rides (
  uid             TEXT PRIMARY KEY,
  ride_id         INTEGER NOT NULL,
  owner_hash      TEXT,
  released        INTEGER NOT NULL DEFAULT 0,
  name            TEXT NOT NULL,
  classification  TEXT,
  first_seen      INTEGER NOT NULL,
  last_seen       INTEGER NOT NULL,
  deleted_at      INTEGER,               -- set when the ride disappeared from the park
  total_profit    INTEGER NOT NULL DEFAULT 0,
  total_customers INTEGER NOT NULL DEFAULT 0,
  excitement      INTEGER,
  data            TEXT NOT NULL          -- latest SnapshotRide as JSON
);
CREATE INDEX IF NOT EXISTS rides_owner ON rides(owner_hash);
CREATE INDEX IF NOT EXISTS rides_alive ON rides(deleted_at);
CREATE TABLE IF NOT EXISTS samples (
  ts          INTEGER NOT NULL,
  hash        TEXT NOT NULL,
  money       INTEGER,
  attractions INTEGER NOT NULL,
  profit      INTEGER NOT NULL,
  guests      INTEGER NOT NULL,
  PRIMARY KEY (ts, hash)
);
CREATE INDEX IF NOT EXISTS samples_hash ON samples(hash, ts);
CREATE TABLE IF NOT EXISTS park_samples (
  ts          INTEGER PRIMARY KEY,
  guests      INTEGER,
  rating      INTEGER,
  online      INTEGER NOT NULL,
  attractions INTEGER NOT NULL,
  ticks       INTEGER
);
`;

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema', '1')").run();
  return db;
}

export function getMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function publicId(hash: string): string {
  return hash.slice(0, 16);
}
