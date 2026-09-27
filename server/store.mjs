import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
export function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dataDir, 'basira.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY,name TEXT NOT NULL,demo INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT,role TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS resources(kind TEXT NOT NULL,id TEXT NOT NULL,tenant_id TEXT NOT NULL REFERENCES tenants(id),entity_id TEXT,version INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(kind,id));
    CREATE INDEX IF NOT EXISTS resource_scope ON resources(tenant_id,kind,entity_id);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,user_id TEXT,action TEXT NOT NULL,resource_id TEXT,created_at TEXT NOT NULL,details TEXT NOT NULL);`);
  const get = db.prepare('SELECT body FROM resources WHERE kind=? AND id=? AND tenant_id=?');
  const list = db.prepare(
    'SELECT body FROM resources WHERE kind=? AND tenant_id=? ORDER BY rowid DESC',
  );
  const put = db.prepare(
    'INSERT INTO resources(kind,id,tenant_id,entity_id,version,body) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET version=excluded.version,entity_id=excluded.entity_id,body=excluded.body WHERE resources.tenant_id=excluded.tenant_id',
  );
  return {
    db,
    get: (kind, id, tenant) => {
      const r = get.get(kind, id, tenant);
      return r ? JSON.parse(r.body) : null;
    },
    list: (kind, tenant, entity) =>
      list
        .all(kind, tenant)
        .map((r) => JSON.parse(r.body))
        .filter((r) => !entity || r.entity_id === entity),
    put: (kind, tenant, o) => {
      put.run(kind, o.id, tenant, o.entity_id || null, o.version || 1, JSON.stringify(o));
      return o;
    },
    transaction: (fn) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const r = fn();
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}
