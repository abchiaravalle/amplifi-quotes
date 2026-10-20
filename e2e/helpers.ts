import type { APIRequestContext, BrowserContext } from '@playwright/test';

export const E2E_SECRET = 'e2e-only-secret';

/** Sign in as a member of `role` (creates it) and put the session cookie into the browser context. */
export async function signInAs(
  request: APIRequestContext,
  context: BrowserContext,
  role = 'owner',
  email?: string,
) {
  const r = await request.post('/api/test/sign-in', {
    headers: { authorization: `Bearer ${E2E_SECRET}` },
    data: { role, email },
  });
  if (!r.ok()) throw new Error(`test sign-in failed: ${r.status()}`);
  const setCookie = r.headers()['set-cookie'] ?? '';
  const m = /aq_session=([^;]+)/.exec(setCookie);
  if (!m) throw new Error('no session cookie');
  const base = new URL(process.env.BASE_URL ?? 'http://localhost:8799');
  await context.addCookies([
    { name: 'aq_session', value: m[1]!, domain: base.hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  return (await r.json()) as { memberId: string };
}
