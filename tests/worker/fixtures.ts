import type { Role } from '../../src/shared/permissions';
import { type Client, client, sql, stub } from './helpers';

/**
 * Sign-in fixtures that don't depend on the auth module (real passkeys can't run in workerd).
 * They write a member + session row directly, exactly as createSession() would, and set the cookie.
 * Use these in every workstream's tests. Auth's own tests exercise the real flows.
 */

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function rand(n = 16): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Mark first-run setup done (as if an owner finished the wizard). Idempotent. */
export async function completeSetup(name = 'Test Co'): Promise<void> {
  await client().get('/api/health'); // make sure the DO exists and is migrated
  const now = Date.now();
  for (const [k, v] of [
    ['workspace.setupComplete', true],
    ['workspace.name', name],
    ['workspace.currency', 'USD'],
    ['workspace.timezone', 'America/New_York'],
  ] as const) {
    await sql(
      `INSERT INTO settings(key,value,updated_at) VALUES (?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      k,
      JSON.stringify(v),
      now,
    );
  }
  await stub().testSetNow(null); // clears the settings cache
}

export interface SignedIn {
  api: Client;
  memberId: string;
  email: string;
  role: Role;
}

/** Create an active member of `role` and return a client signed in as them. */
export async function signIn(
  role: Role,
  opts: {
    email?: string;
    name?: string;
    grants?: { canOverridePrices?: boolean; canSeeCost?: boolean };
  } = {},
): Promise<SignedIn> {
  await completeSetup();
  const id = `mbr_${rand(8)}`;
  const email = opts.email ?? `${role}-${rand(4)}@example.com`;
  const now = Date.now();
  await sql(
    `INSERT INTO members(id,email,name,role,status,grants,created_at,updated_at)
     VALUES (?,?,?,?, 'active', ?, ?, ?)`,
    id,
    email,
    opts.name ?? `${role} user`,
    role,
    JSON.stringify(opts.grants ?? {}),
    now,
    now,
  );
  const token = rand(32);
  await sql(
    `INSERT INTO sessions(id,member_id,created_at,last_seen_at,expires_at,user_agent,ip)
     VALUES (?,?,?,?,?, 'test', '')`,
    await sha256Hex(token),
    id,
    now,
    now,
    now + 30 * 24 * 3_600_000,
  );
  const api = client();
  api.cookie = `aq_session=${token}`;
  return { api, memberId: id, email, role };
}

/** One signed-in client per role. */
export async function team(): Promise<Record<Role, SignedIn>> {
  const roles: Role[] = ['owner', 'admin', 'pricing_editor', 'approver', 'sales', 'viewer'];
  const out = {} as Record<Role, SignedIn>;
  for (const r of roles) out[r] = await signIn(r);
  return out;
}
