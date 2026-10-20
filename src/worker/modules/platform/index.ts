import { createSession, requirePermission, sessionCookie } from '../../app/session';
import { LATEST_SCHEMA } from '../../db/migrate';
import { constantTimeEqual, sha256Hex } from '../../lib/crypto';
import { notFound } from '../../lib/errors';
import { newId, randomToken } from '../../lib/ids';
import { OUTBOUND_HOSTS } from '../../services/outbound';
import type { Module } from '..';

/** Platform routes owned by the foundation: about/version, outbound hosts list (ADM-3, UPD-6). */
export const platformModule: Module = {
  name: 'platform',
  init(ws) {
    ws.jobs.register('outbox.deliver', async () => {
      await ws.outbox.drain();
    });
  },
  routes(app, ws) {
    app.get('/api/about', (c) => {
      requirePermission(c, 'report.view');
      return c.json({
        version: ws.env.APP_VERSION,
        edition: ws.env.EDITION,
        schemaVersion: LATEST_SCHEMA,
        engineVersion: null as string | null,
        updateCheck: ws.settings.get('updates.check'),
      });
    });
    /**
     * e2e-only sign-in (TST-5). 404 unless E2E_SECRET is configured AND the bearer matches.
     * Creates (or reuses) an active member with the role and returns a session cookie, and marks
     * setup complete so browser tests can start anywhere. Never available in a real deployment.
     */
    app.post('/api/test/sign-in', async (c) => {
      const secret = ws.env.E2E_SECRET;
      const bearer = (c.req.header('authorization') ?? '').replace(/^Bearer /, '');
      if (!secret || !bearer || !constantTimeEqual(secret, bearer)) throw notFound();
      const body = (await c.req.json()) as {
        role?: string;
        email?: string;
        name?: string;
        completeSetup?: boolean;
      };
      const role = body.role ?? 'owner';
      const email = (body.email ?? `${role}@e2e.test`).toLowerCase();
      const now = ws.clock.now();
      if (body.completeSetup !== false) ws.settings.set('workspace.setupComplete', true);
      let member = ws.db.one<{ id: string }>('SELECT id FROM members WHERE email=?', email);
      if (!member) {
        const id = newId('mbr', now);
        ws.db.run(
          "INSERT INTO members(id,email,name,role,status,grants,created_at,updated_at) VALUES (?,?,?,?, 'active', '{}', ?, ?)",
          id,
          email,
          body.name ?? `${role} (e2e)`,
          role,
          now,
          now,
        );
        member = { id };
      }
      const token = await createSession(ws, member.id, 'e2e', '');
      c.header('set-cookie', sessionCookie(token, new URL(c.req.url).protocol === 'https:'));
      return c.json({ memberId: member.id, token: await sha256Hex(randomToken(4)) });
    });

    app.get('/api/outbound-hosts', (c) => {
      requirePermission(c, 'integration.manage');
      return c.json({ hosts: OUTBOUND_HOSTS });
    });
  },
};
