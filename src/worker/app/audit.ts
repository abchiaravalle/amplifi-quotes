import type { Db } from '../db/sql';
import type { Clock } from './types';

export type ActorType = 'member' | 'customer' | 'system' | 'staff' | 'api_key';

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** Append-only audit log (ADM-4, SEC-13). Writes happen in the caller's transaction when inside db.tx(). */
export class Audit {
  constructor(
    private db: Db,
    private clock: Clock,
  ) {}

  log(e: AuditEntry): void {
    this.db.run(
      `INSERT INTO audit_log(at, actor_type, actor_id, action, target_type, target_id, before, after, ip)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      this.clock.now(),
      e.actorType,
      e.actorId ?? null,
      e.action,
      e.targetType ?? '',
      e.targetId ?? '',
      e.before === undefined ? null : JSON.stringify(e.before),
      e.after === undefined ? null : JSON.stringify(e.after),
      e.ip ?? '',
    );
  }
}
