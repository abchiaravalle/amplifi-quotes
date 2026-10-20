import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { type Action, can, type PolicyContext } from '../../shared/permissions';
import { sha256Hex } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/errors';
import { randomToken } from '../lib/ids';
import type { AppContext, AppEnv, Member, WsCtx } from './types';

export const SESSION_COOKIE = 'aq_session';
export const SESSION_IDLE_MS = 12 * 3_600_000; // AUTH-7
export const SESSION_MAX_MS = 30 * 24 * 3_600_000;

interface SessionRow {
  id: string;
  member_id: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  revoked_at: number | null;
}

interface MemberRow {
  id: string;
  email: string;
  name: string;
  role: Member['role'];
  status: Member['status'];
  grants: string;
}

export function toMember(r: MemberRow): Member {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    status: r.status,
    grants: JSON.parse(r.grants || '{}'),
  };
}

/**
 * Create a session for a member. Returns the raw token (goes in the cookie) - the database stores only
 * its SHA-256 hash (AUTH-6). Callers set the cookie with sessionCookie().
 */
export async function createSession(
  ws: WsCtx,
  memberId: string,
  userAgent: string,
  ip: string,
): Promise<string> {
  const token = randomToken(32);
  const id = await sha256Hex(token);
  const now = ws.clock.now();
  ws.db.run(
    `INSERT INTO sessions(id, member_id, created_at, last_seen_at, expires_at, user_agent, ip)
     VALUES (?,?,?,?,?,?,?)`,
    id,
    memberId,
    now,
    now,
    now + SESSION_MAX_MS,
    userAgent.slice(0, 300),
    ip,
  );
  ws.db.run('UPDATE members SET last_sign_in_at=? WHERE id=?', now, memberId);
  return token;
}

export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_MS / 1000}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** Revoke sessions. Pass exceptSessionId to keep the current one. */
export function revokeSessions(ws: WsCtx, memberId: string, exceptSessionId?: string): number {
  const r = exceptSessionId
    ? ws.db.run(
        'UPDATE sessions SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL AND id<>?',
        ws.clock.now(),
        memberId,
        exceptSessionId,
      )
    : ws.db.run(
        'UPDATE sessions SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL',
        ws.clock.now(),
        memberId,
      );
  return r.rowsWritten;
}

/** Resolve the session cookie on every request. Sets c.var.member / c.var.session or null. */
export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('member', null);
  c.set('session', null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token && token.length >= 20 && token.length <= 100) {
    const ws = c.var.ws;
    const id = await sha256Hex(token);
    const s = ws.db.one<SessionRow>(
      'SELECT id, member_id, created_at, last_seen_at, expires_at, revoked_at FROM sessions WHERE id=?',
      id,
    );
    const now = ws.clock.now();
    if (s && !s.revoked_at && s.expires_at > now && now - s.last_seen_at < SESSION_IDLE_MS) {
      const m = ws.db.one<MemberRow>(
        'SELECT id, email, name, role, status, grants FROM members WHERE id=?',
        s.member_id,
      );
      if (m && m.status === 'active') {
        c.set('member', toMember(m));
        c.set('session', {
          id: s.id,
          memberId: s.member_id,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        });
        // touch at most once a minute to limit writes
        if (now - s.last_seen_at > 60_000 && !ws.readOnly) {
          ws.db.run('UPDATE sessions SET last_seen_at=? WHERE id=?', now, s.id);
        }
      }
    }
  }
  await next();
};

/** Require a signed-in member. */
export function requireMember(c: AppContext): Member {
  const m = c.var.member;
  if (!m) throw unauthorized();
  return m;
}

/** Policy context with workspace settings filled in. */
export function policyCtx(ws: WsCtx, recordOwnerId?: string | null): PolicyContext {
  return {
    recordOwnerId,
    settings: {
      salesSeeTeamQuotes: ws.settings.get('workspace.salesSeeTeamQuotes'),
      allowSelfApproval: ws.settings.get('workspace.allowSelfApproval'),
    },
  };
}

/**
 * Require a member allowed to do `action` (SEC-1). Pass recordOwnerId when acting on a record so
 * 'own' / 'own_team' / 'not_own' rules apply.
 */
export function requirePermission(c: AppContext, action: Action, recordOwnerId?: string | null): Member {
  const m = requireMember(c);
  if (!can({ role: m.role, memberId: m.id, grants: m.grants }, action, policyCtx(c.var.ws, recordOwnerId))) {
    throw forbidden(`Your role can't do this (${action})`);
  }
  return m;
}

/** Non-throwing check */
export function allowed(c: AppContext, action: Action, recordOwnerId?: string | null): boolean {
  const m = c.var.member;
  if (!m) return false;
  return can({ role: m.role, memberId: m.id, grants: m.grants }, action, policyCtx(c.var.ws, recordOwnerId));
}
