import { Hono } from 'hono';
import { INTERNAL_HEADERS } from '../env';
import { ApiError, errorBody } from '../lib/errors';
import { MODULES } from '../modules';
import { sessionMiddleware } from './session';
import type { AppEnv, WsCtx } from './types';

/**
 * Builds the Hono app that runs INSIDE the workspace Durable Object. Every /api route lives here.
 * Modules register their routes through src/worker/modules/index.ts (one entry per workstream).
 */
export function buildApp(ws: WsCtx): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('ws', ws);
    c.set('ip', c.req.header(INTERNAL_HEADERS.ip) ?? '');
    c.set('country', c.req.header(INTERNAL_HEADERS.country) ?? '');
    c.set('host', c.req.header(INTERNAL_HEADERS.host) ?? new URL(c.req.url).host);
    c.set('apiKey', null);
    await next();
  });

  // SEC-2: state-changing requests must come from our own origin (cookies are SameSite=Lax too).
  app.use('/api/*', async (c, next) => {
    const m = c.req.method;
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      const isPublicApi = c.req.path.startsWith('/api/v1/') || c.req.path.startsWith('/api/hooks/');
      const origin = c.req.header('origin');
      if (!isPublicApi && origin) {
        const host = c.var.host;
        let ok = false;
        try {
          ok = new URL(origin).host === host;
        } catch {
          ok = false;
        }
        if (!ok) throw new ApiError(403, 'bad_origin', 'Cross-site request refused');
      }
    }
    await next();
  });

  // UPD-5: database newer than code -> no writes at all.
  app.use('/api/*', async (c, next) => {
    if (ws.readOnly && c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      throw new ApiError(
        503,
        'read_only',
        'This deployment is older than its database. Restore a backup or update.',
      );
    }
    await next();
  });

  app.use('*', sessionMiddleware);

  // DEP-5: until setup is complete, only setup + health routes work.
  app.use('/api/*', async (c, next) => {
    const p = c.req.path;
    const open = p === '/api/health' || p.startsWith('/api/setup') || p.startsWith('/api/test/');
    if (!open && !ws.settings.get('workspace.setupComplete')) {
      throw new ApiError(503, 'setup_required', 'Finish setup first');
    }
    await next();
  });

  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      version: ws.env.APP_VERSION,
      setupComplete: ws.settings.get('workspace.setupComplete'),
      readOnly: ws.readOnly,
    }),
  );

  for (const mod of MODULES) mod.routes(app, ws);

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));
  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json(errorBody(err), err.status as 400);
    if (err && typeof err === 'object' && 'issues' in err) {
      // zod error
      return c.json(
        {
          error: { code: 'invalid', message: 'Invalid input', details: (err as { issues: unknown }).issues },
        },
        400,
      );
    }
    console.error('unhandled', err);
    return c.json({ error: { code: 'internal', message: 'Something went wrong' } }, 500);
  });

  return app;
}
