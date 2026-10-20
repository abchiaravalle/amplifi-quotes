import { DurableObject } from 'cloudflare:workers';
import type { Hono } from 'hono';
import { buildApp } from './app/app';
import { Audit } from './app/audit';
import { RateLimiter } from './app/ratelimit';
import type { AppEnv, Clock, WsCtx } from './app/types';
import { migrate } from './db/migrate';
import { Db } from './db/sql';
import type { Env } from './env';
import { MODULES } from './modules';
import { Events } from './services/events';
import { Jobs } from './services/jobs';
import { Live } from './services/live';
import { Outbound } from './services/outbound';
import { Outbox } from './services/outbox';
import { RpcRegistry, Services } from './services/registry';
import { Settings } from './services/settings';

/** Test hook: tests can replace the clock and the outbound fetch on a live instance. */

/**
 * One instance per workspace. All workspace reads and writes happen here, one request at a time,
 * so there are no cross-request races on quote state (QT-8).
 */
export class WorkspaceDO extends DurableObject<Env> {
  private ws: WsCtx;
  private app: Hono<AppEnv>;
  private nowOverride: number | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    const clock: Clock = {
      now: () => this.nowOverride ?? (env.TEST_NOW ? Number(env.TEST_NOW) : Date.now()),
    };
    const db = new Db(state.storage.sql, state.storage);
    const settings = new Settings(db, clock);
    const jobs = new Jobs(db, state.storage, clock);
    const http = new Outbound();
    const outbox = new Outbox(db, clock, jobs, http);
    let readOnly = false;
    state.blockConcurrencyWhile(async () => {
      const r = migrate(db);
      readOnly = r.readOnly;
    });
    const ws: WsCtx = {
      workspaceId: state.id.toString(),
      env,
      state,
      db,
      clock,
      settings,
      audit: new Audit(db, clock),
      jobs,
      outbox,
      live: new Live(state),
      http,
      limiter: new RateLimiter(db, clock),
      events: new Events(),
      services: new Services(),
      rpc: new RpcRegistry(),
      get readOnly() {
        return readOnly;
      },
      today() {
        const tz = settings.get('workspace.timezone') || 'UTC';
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(clock.now()));
      },
    };
    this.ws = ws;
    for (const m of MODULES) m.init?.(ws);
    this.app = buildApp(ws);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws' && request.headers.get('upgrade') === 'websocket') {
      return this.app.fetch(request);
    }
    this.ws.db.resetCounters();
    const res = await this.app.fetch(request);
    this.recordUsage();
    return res;
  }

  override async alarm(): Promise<void> {
    await this.ws.jobs.runDue();
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.ws.live.onMessage(ws, message);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.ws.live.onClose(ws);
  }

  /** Count requests and rows per day (ADM-1). One upsert per request. */
  private recordUsage(): void {
    if (this.ws.readOnly) return;
    const { rowsRead, rowsWritten } = this.ws.db.resetCounters();
    const day = new Date(this.ws.clock.now()).toISOString().slice(0, 10);
    try {
      this.ws.db.run(
        `INSERT INTO usage_daily(day, requests, rows_read, rows_written) VALUES (?,1,?,?)
         ON CONFLICT(day) DO UPDATE SET requests=requests+1, rows_read=rows_read+excluded.rows_read,
         rows_written=rows_written+excluded.rows_written+1`,
        day,
        rowsRead,
        rowsWritten,
      );
    } catch {
      // usage counting must never break a request
    }
    this.ws.db.resetCounters();
  }

  /** Module RPC entry point (hosted sign-up, staff console, directory callbacks). */
  async rpc(name: string, args: unknown): Promise<unknown> {
    return this.ws.rpc.call(name, args);
  }

  // ---- test hooks (RPC). Harmless in production: they only affect this instance's memory. ----
  testSetNow(ms: number | null): void {
    this.nowOverride = ms;
    this.ws.settings.clearCache();
  }
  /**
   * Replace outbound fetch with canned responses. Rules match by URL prefix, first match wins.
   * Unmatched URLs get a 599 so a test notices. Pass null to restore real fetch.
   */
  testMockFetch(
    rules: { prefix: string; status: number; body: string; headers?: Record<string, string> }[] | null,
  ): void {
    if (rules === null) {
      this.ws.http.setImpl((u, i) => fetch(u, i));
      return;
    }
    this.ws.http.setImpl(async (url) => {
      const r = rules.find((x) => url.startsWith(x.prefix));
      if (!r) return new Response(`no mock for ${url}`, { status: 599 });
      return new Response(r.body, {
        status: r.status,
        headers: r.headers ?? { 'content-type': 'application/json' },
      });
    });
  }
  /** Request bodies sent through the mocked fetch are recorded too */
  testClearOutbound(): void {
    this.ws.http.calls.length = 0;
  }
  testOutboundCalls(): { url: string; method: string; purpose: string; body?: string }[] {
    return [...this.ws.http.calls];
  }
  testRunAlarm(): Promise<{ ran: number; failed: number }> {
    return this.ws.jobs.runDue();
  }
  testSql(query: string, ...params: (string | number | null)[]): Record<string, unknown>[] {
    return this.ws.db.all(query, ...params);
  }
  testEvents(): { name: string; payload: unknown }[] {
    return [...this.ws.events.recent];
  }
  testCtx(): WsCtx {
    return this.ws;
  }
}
