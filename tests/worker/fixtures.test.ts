import { describe, expect, it } from 'vitest';
import { completeSetup, signIn } from './fixtures';
import { client } from './helpers';

describe('test fixtures', () => {
  it('signs in a member through a real session row', async () => {
    const o = await signIn('owner');
    const r = await o.api.get('/api/about');
    expect(r.status).toBe(200);
    expect(r.body.edition).toBe('self');
  });

  it('anonymous requests after setup get 401 on member routes', async () => {
    await completeSetup();
    const r = await client().get('/api/about');
    expect(r.status).toBe(401);
  });

  it('roles without permission get 403', async () => {
    const s = await signIn('sales');
    const r = await s.api.get('/api/outbound-hosts');
    expect(r.status).toBe(403);
  });

  it('lists outbound hosts for admins (ADM-3)', async () => {
    const a = await signIn('admin');
    const r = await a.api.get('/api/outbound-hosts');
    expect(r.status).toBe(200);
    expect(r.body.hosts.length).toBeGreaterThan(10);
  });
});
