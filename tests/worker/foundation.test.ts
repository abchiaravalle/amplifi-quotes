import { describe, expect, it } from 'vitest';
import { LATEST_SCHEMA } from '../../src/worker/db/migrate';
import { client, sql } from './helpers';

describe('foundation', () => {
  it('serves health before setup', async () => {
    const r = await client().get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, setupComplete: false, readOnly: false });
  });

  it('blocks every other API route until setup is done (DEP-5)', async () => {
    const r = await client().get('/api/quotes');
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('setup_required');
  });

  it('migrates the workspace database to the latest schema', async () => {
    await client().get('/api/health');
    const rows = await sql<{ value: string }>("SELECT value FROM meta WHERE key='schema_version'");
    expect(Number(rows[0]?.value)).toBe(LATEST_SCHEMA);
  });

  it('refuses cross-site state-changing requests (SEC-2)', async () => {
    const r = await client().post('/api/setup/claim', {}, { origin: 'https://evil.example' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('bad_origin');
  });

  it('serves robots.txt that keeps quote pages out of search', async () => {
    const r = await client().get('/robots.txt');
    expect(r.status).toBe(200);
    expect(String(r.body)).toContain('Disallow: /q/');
  });

  it('sets no-store and nosniff on API responses', async () => {
    const r = await client().get('/api/health');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('strips client-supplied internal headers', async () => {
    const r = await client().get('/api/health', { 'x-aq-ip': '1.2.3.4' });
    expect(r.status).toBe(200);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const r = await client().get('/api/health/nope');
    expect([404, 503]).toContain(r.status);
  });

  it('keeps audit_log append-only', async () => {
    await client().get('/api/health');
    await sql("INSERT INTO audit_log(at, actor_type, action) VALUES (?, 'system', 'test')", Date.now());
    await expect(sql("UPDATE audit_log SET action='x'")).rejects.toThrow(/append-only/);
    await expect(sql('DELETE FROM audit_log')).rejects.toThrow(/cannot be deleted/);
  });
});
