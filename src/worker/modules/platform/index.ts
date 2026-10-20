import { requirePermission } from '../../app/session';
import { LATEST_SCHEMA } from '../../db/migrate';
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
    app.get('/api/outbound-hosts', (c) => {
      requirePermission(c, 'integration.manage');
      return c.json({ hosts: OUTBOUND_HOSTS });
    });
  },
};
