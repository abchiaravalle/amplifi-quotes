import type { Clock } from '../app/types';
import type { Db } from '../db/sql';
import { newId } from '../lib/ids';
import type { Jobs } from './jobs';
import type { Outbound } from './outbound';

/**
 * Durable delivery queue for email, webhooks, CRM calls and chat alerts (INT-6, INT-7, EML-6).
 * Producers call enqueue() inside their own transaction. A job drains it with retries at
 * 1m, 5m, 30m, 2h, 12h, then marks failed. At most 40 outbound calls per run.
 */
export type OutboxKind = 'email' | 'webhook' | 'crm' | 'chat';

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  target: string;
  payload: unknown;
  attempts: number;
}

/** A sender returns ok, or throws / returns {ok:false} to retry. */
export type Sender = (
  item: OutboxItem,
  http: Outbound,
) => Promise<{ ok: boolean; status?: number; error?: string }>;

export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];
export const MAX_PER_RUN = 40;

export class Outbox {
  private senders = new Map<OutboxKind, Sender>();
  constructor(
    private db: Db,
    private clock: Clock,
    private jobs: Jobs,
    private http: Outbound,
  ) {}

  registerSender(kind: OutboxKind, sender: Sender): void {
    this.senders.set(kind, sender);
  }

  /** Add an item. Call schedule() after the surrounding transaction commits (or rely on enqueueNow). */
  enqueue(kind: OutboxKind, target: string, payload: unknown, delayMs = 0): string {
    const id = newId('obx', this.clock.now());
    this.db.run(
      `INSERT INTO outbox(id, kind, target, payload, status, attempts, next_attempt_at, created_at)
       VALUES (?,?,?,?, 'pending', 0, ?, ?)`,
      id,
      kind,
      target,
      JSON.stringify(payload),
      this.clock.now() + delayMs,
      this.clock.now(),
    );
    return id;
  }

  /** Make sure a drain job is scheduled for the earliest pending item. */
  async schedule(): Promise<void> {
    const next = this.db.value<number>("SELECT min(next_attempt_at) FROM outbox WHERE status='pending'");
    if (next != null) await this.jobs.schedule('outbox.deliver', 'main', Math.max(next, this.clock.now()));
  }

  /** Deliver due items. Returns counts. */
  async drain(): Promise<{ sent: number; retried: number; failed: number; remaining: number }> {
    const now = this.clock.now();
    const due = this.db.all<{
      id: string;
      kind: OutboxKind;
      target: string;
      payload: string;
      attempts: number;
    }>(
      `SELECT id, kind, target, payload, attempts FROM outbox
       WHERE status='pending' AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT ?`,
      now,
      MAX_PER_RUN,
    );
    let sent = 0;
    let retried = 0;
    let failed = 0;
    for (const row of due) {
      const sender = this.senders.get(row.kind);
      const item: OutboxItem = {
        id: row.id,
        kind: row.kind,
        target: row.target,
        payload: JSON.parse(row.payload),
        attempts: row.attempts,
      };
      let res: { ok: boolean; status?: number; error?: string };
      try {
        res = sender ? await sender(item, this.http) : { ok: false, error: `no sender for ${row.kind}` };
      } catch (e) {
        res = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      const attempts = row.attempts + 1;
      this.db.run(
        'INSERT INTO outbox_attempts(id, outbox_id, at, ok, status_code, error) VALUES (?,?,?,?,?,?)',
        newId('oba', now),
        row.id,
        now,
        res.ok ? 1 : 0,
        res.status ?? null,
        res.error ?? '',
      );
      if (res.ok) {
        this.db.run(
          "UPDATE outbox SET status='sent', attempts=?, sent_at=?, last_error='' WHERE id=?",
          attempts,
          now,
          row.id,
        );
        sent++;
      } else if (attempts > RETRY_DELAYS_MS.length) {
        this.db.run(
          "UPDATE outbox SET status='failed', attempts=?, last_error=? WHERE id=?",
          attempts,
          res.error ?? '',
          row.id,
        );
        failed++;
      } else {
        const delay = RETRY_DELAYS_MS[attempts - 1]!;
        this.db.run(
          'UPDATE outbox SET attempts=?, next_attempt_at=?, last_error=? WHERE id=?',
          attempts,
          now + delay,
          res.error ?? '',
          row.id,
        );
        retried++;
      }
    }
    const remaining = this.db.value<number>("SELECT count(*) FROM outbox WHERE status='pending'") ?? 0;
    await this.schedule();
    return { sent, retried, failed, remaining };
  }

  /** Manual retry of a failed item (Admin > Deliveries) */
  async retry(id: string): Promise<boolean> {
    const r = this.db.run(
      "UPDATE outbox SET status='pending', next_attempt_at=? WHERE id=? AND status='failed'",
      this.clock.now(),
      id,
    );
    await this.schedule();
    return r.rowsWritten > 0;
  }
}
