import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

/**
 * Hosted edition directory (HST-1). One global instance ("directory"). Holds ONLY workspaces,
 * hostnames, plans and billing state. Never quote data.
 * The hosted workstream implements the methods; the self-deployed edition never calls it.
 */
export class DirectoryDO extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'trial',
          status TEXT NOT NULL DEFAULT 'active',
          jurisdiction TEXT NOT NULL DEFAULT '',
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          grace_until INTEGER,
          created_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS domains (
          hostname TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          cf_hostname_id TEXT,
          verification TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_domains_ws ON domains(workspace_id);
      `);
    });
  }

  /** hostname -> { workspaceId, jurisdiction } or null */
  async resolveHost(
    hostname: string,
  ): Promise<{ workspaceId: string; jurisdiction: string; status: string } | null> {
    const base = this.env.HOSTED_BASE_DOMAIN ?? '';
    let row: Record<string, unknown> | undefined;
    if (base && hostname.endsWith(`.${base}`)) {
      const slug = hostname.slice(0, -(base.length + 1));
      row = this.ctx.storage.sql
        .exec('SELECT id, jurisdiction, status FROM workspaces WHERE slug=? AND deleted_at IS NULL', slug)
        .toArray()[0];
    } else {
      row = this.ctx.storage.sql
        .exec(
          `SELECT w.id AS id, w.jurisdiction AS jurisdiction, w.status AS status FROM domains d
           JOIN workspaces w ON w.id=d.workspace_id WHERE d.hostname=? AND d.status='active' AND w.deleted_at IS NULL`,
          hostname,
        )
        .toArray()[0];
    }
    if (!row) return null;
    return {
      workspaceId: String(row.id),
      jurisdiction: String(row.jurisdiction ?? ''),
      status: String(row.status),
    };
  }
}
