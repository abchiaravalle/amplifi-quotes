import type { Context } from 'hono';
import type { Role } from '../../shared/permissions';
import type { Db } from '../db/sql';
import type { Env } from '../env';
import type { Events } from '../services/events';
import type { Jobs } from '../services/jobs';
import type { Live } from '../services/live';
import type { Outbound } from '../services/outbound';
import type { Outbox } from '../services/outbox';
import type { Settings } from '../services/settings';
import type { Audit } from './audit';
import type { RateLimiter } from './ratelimit';

export interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'removed';
  grants: { canOverridePrices?: boolean; canSeeCost?: boolean };
}

export interface SessionInfo {
  id: string;
  memberId: string;
  createdAt: number;
  expiresAt: number;
}

export interface Clock {
  now(): number;
}

/**
 * Everything a route or job needs about the current workspace. One instance per Durable Object.
 * Routes reach it through c.var.ws.
 */
export interface WsCtx {
  workspaceId: string;
  env: Env;
  state: DurableObjectState;
  db: Db;
  clock: Clock;
  settings: Settings;
  audit: Audit;
  jobs: Jobs;
  outbox: Outbox;
  live: Live;
  http: Outbound;
  limiter: RateLimiter;
  events: Events;
  /** true when the database schema is newer than the code (UPD-5) */
  readOnly: boolean;
  /** today's date (YYYY-MM-DD) in the workspace time zone */
  today(): string;
}

export type AppEnv = {
  Variables: {
    ws: WsCtx;
    member: Member | null;
    session: SessionInfo | null;
    ip: string;
    country: string;
    host: string;
    /** set when the request authenticated with an API key (INT-1) */
    apiKey: { id: string; scopes: string[] } | null;
  };
};

export type AppContext = Context<AppEnv>;
