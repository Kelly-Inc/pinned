// Applies database migrations in order and records which ones have run.
// Migrations are idempotent so databases created before this runner existed
// upgrade cleanly too.
import { db, transaction } from './connection.js';
import { migrations } from './migrations/index.js';
import { log } from '../util/logger.js';

export function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((r) => r.id));
  let count = 0;
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migration.id);
    });
    log.info(`migration applied: ${migration.id}`);
    count += 1;
  }
  return count;
}
