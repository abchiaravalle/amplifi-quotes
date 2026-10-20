import type { Clock } from '../app/types';
import type { Db } from '../db/sql';
import { newId } from '../lib/ids';

/**
 * Scheduled work on Durable Object alarms (no Cron Triggers). Jobs are rows in `jobs`; the alarm is
 * always set to the earliest run_at. Handlers are registered by kind at startup.
 *
 * Built-in kinds: 'outbox.deliver', 'quote.expire', 'reminder.send', 'approval.remind',
 * 'usage.daily', 'fx.fetch', 'backup.nightly'. Workstreams register their own handlers.
 */
export type JobHandler = (job: {
  id: string;
  kind: string;
  ref: string;
  data: unknown;
}) => Promise<void> | void;

export class Jobs {
  private handlers = new Map<string, JobHandler>();
  constructor(
    private db: Db,
    private storage: DurableObjectStorage,
    private clock: Clock,
  ) {}

  register(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  /** Schedule (or reschedule) a job. (kind, ref) is unique: scheduling again moves it. */
  async schedule(kind: string, ref: string, runAt: number, data: unknown = {}): Promise<void> {
    this.db.run(
      `INSERT INTO jobs(id, kind, ref, run_at, data) VALUES (?,?,?,?,?)
       ON CONFLICT(kind, ref) DO UPDATE SET run_at=excluded.run_at, data=excluded.data`,
      newId('job', this.clock.now()),
      kind,
      ref,
      runAt,
      JSON.stringify(data),
    );
    await this.arm();
  }

  async cancel(kind: string, ref: string): Promise<void> {
    this.db.run('DELETE FROM jobs WHERE kind=? AND ref=?', kind, ref);
    await this.arm();
  }

  /** Set the DO alarm to the earliest pending job. */
  async arm(): Promise<void> {
    const next = this.db.value<number>('SELECT min(run_at) FROM jobs');
    if (next == null) {
      await this.storage.deleteAlarm();
      return;
    }
    const current = await this.storage.getAlarm();
    if (current == null || current > next || current < this.clock.now() - 60_000) {
      await this.storage.setAlarm(Math.max(next, this.clock.now() + 1));
    }
  }

  /** Run all due jobs (called from the DO alarm). Failed jobs are retried after 5 minutes. */
  async runDue(limit = 50): Promise<{ ran: number; failed: number }> {
    const now = this.clock.now();
    const due = this.db.all<{ id: string; kind: string; ref: string; data: string }>(
      'SELECT id, kind, ref, data FROM jobs WHERE run_at <= ? ORDER BY run_at LIMIT ?',
      now,
      limit,
    );
    let ran = 0;
    let failed = 0;
    for (const j of due) {
      const h = this.handlers.get(j.kind);
      // delete first so a handler can reschedule itself under the same (kind, ref)
      this.db.run('DELETE FROM jobs WHERE id=?', j.id);
      if (!h) continue;
      try {
        await h({ id: j.id, kind: j.kind, ref: j.ref, data: JSON.parse(j.data) });
        ran++;
      } catch (e) {
        failed++;
        console.error(`job ${j.kind}/${j.ref} failed`, e);
        await this.schedule(j.kind, j.ref, now + 5 * 60_000, JSON.parse(j.data));
      }
    }
    await this.arm();
    return { ran, failed };
  }
}
