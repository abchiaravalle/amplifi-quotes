import type { Db } from '../db/sql';
import type { Clock } from './types';

/**
 * Exact rate limiter backed by the workspace database (SEC-9). Cloudflare's rate-limit binding is
 * per-location and can lag, so safety limits count here instead.
 */
export class RateLimiter {
  constructor(
    private db: Db,
    private clock: Clock,
  ) {}

  /**
   * Record one hit for key. Returns false (blocked) when the key is locked or the hit exceeds
   * `limit` within `windowMs`. When exceeded and lockMs is set, the key locks for lockMs.
   */
  hit(key: string, limit: number, windowMs: number, lockMs = 0): boolean {
    const now = this.clock.now();
    const row = this.db.one<{ window_start: number; count: number; locked_until: number | null }>(
      'SELECT window_start, count, locked_until FROM rate_limits WHERE key=?',
      key,
    );
    if (row?.locked_until && row.locked_until > now) return false;
    if (!row || now - row.window_start >= windowMs) {
      this.db.run(
        `INSERT INTO rate_limits(key, window_start, count, locked_until) VALUES (?,?,1,NULL)
         ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start, count=1, locked_until=NULL`,
        key,
        now,
      );
      return true;
    }
    const count = row.count + 1;
    const exceeded = count > limit;
    this.db.run(
      'UPDATE rate_limits SET count=?, locked_until=? WHERE key=?',
      count,
      exceeded && lockMs > 0 ? now + lockMs : null,
      key,
    );
    return !exceeded;
  }

  /** Is the key currently blocked, without recording a hit */
  blocked(key: string, limit: number, windowMs: number): boolean {
    const now = this.clock.now();
    const row = this.db.one<{ window_start: number; count: number; locked_until: number | null }>(
      'SELECT window_start, count, locked_until FROM rate_limits WHERE key=?',
      key,
    );
    if (!row) return false;
    if (row.locked_until && row.locked_until > now) return true;
    return now - row.window_start < windowMs && row.count >= limit;
  }

  clear(key: string): void {
    this.db.run('DELETE FROM rate_limits WHERE key=?', key);
  }
}
