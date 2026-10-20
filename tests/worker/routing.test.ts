import { describe, expect, it } from 'vitest';
import { client } from './helpers';

describe('routing', () => {
  it('serves the customer page entry for /q/:token with noindex', async () => {
    const r = await client().get('/q/abc123');
    expect(r.status).toBe(200);
    expect(String(r.body).toLowerCase()).toContain('<div id="root">');
    expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
  it('does not redirect the customer page', async () => {
    const r = await client().get('/q/abc123');
    expect(r.raw.redirected).toBe(false);
    // q.html loads the customer entry, not the main app entry
    expect(String(r.body)).toMatch(/assets\/q-[^"]+\.js/);
  });
  it('serves the app shell for other paths', async () => {
    const r = await client().get('/settings/members');
    expect(r.status).toBe(200);
  });
});

describe('e2e test sign-in route', () => {
  it('is not available without E2E_SECRET (TST-5 safety)', async () => {
    const r = await client().post(
      '/api/test/sign-in',
      { role: 'owner' },
      { authorization: 'Bearer anything' },
    );
    expect(r.status).toBe(404);
  });
});
