import { m0001 } from './migrations/0001_init';
import { m0002 } from './migrations/0002_auth';
import { m0003 } from './migrations/0003_data';
import { m0004 } from './migrations/0004_quotes';
import { m0005 } from './migrations/0005_comms';
import { m0006 } from './migrations/0006_integrations';
import { m0007 } from './migrations/0007_hosted';
import { m0008 } from './migrations/0008_reserved';
import type { Db } from './sql';

export interface Migration {
  version: number;
  name: string;
  /** SQL script. Empty string = no-op slot (kept so version numbers never shift). */
  sql: string;
}

/**
 * Forward-only, in order. Each workstream owns one slot file; add statements there instead of
 * creating new files, so version numbers stay stable across parallel branches.
 */
export const MIGRATIONS: Migration[] = [m0001, m0002, m0003, m0004, m0005, m0006, m0007, m0008];
export const LATEST_SCHEMA = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export interface MigrateResult {
  from: number;
  to: number;
  applied: number[];
  /** true when the database is newer than this code (UPD-5): the app must refuse writes */
  readOnly: boolean;
}

function currentVersion(db: Db): number {
  const exists = db.value<number>("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='meta'");
  if (!exists) return 0;
  const v = db.value<string>("SELECT value FROM meta WHERE key='schema_version'");
  return v ? Number(v) : 0;
}

/**
 * Apply pending migrations inside ONE transaction (UPD-4). If the stored schema is newer than the
 * code, apply nothing and report readOnly (UPD-5).
 */
export function migrate(db: Db, onBeforeApply?: (from: number, to: number) => void): MigrateResult {
  const from = currentVersion(db);
  if (from > LATEST_SCHEMA) return { from, to: from, applied: [], readOnly: true };
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length === 0) return { from, to: from, applied: [], readOnly: false };
  onBeforeApply?.(from, LATEST_SCHEMA);
  db.tx(() => {
    for (const m of pending) {
      if (m.sql.trim()) db.exec(m.sql);
    }
    db.run(
      "INSERT INTO meta(key,value) VALUES('schema_version',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      String(LATEST_SCHEMA),
    );
  });
  return { from, to: LATEST_SCHEMA, applied: pending.map((m) => m.version), readOnly: false };
}
