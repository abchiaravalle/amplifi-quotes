import type { Env } from './env';
import { hostedRouter } from './hosted-router';
import {
  customerPageHook,
  forward,
  isAppPath,
  SELF_WORKSPACE_NAME,
  withSecurityHeaders,
  workspaceStub,
} from './routing';

export { DirectoryDO } from './directory-do';
export { WorkspaceDO } from './workspace-do';

// Only the default handler and Durable Object classes may be exported from the main module
// (workerd rejects other named exports). Shared helpers live in ./routing.ts.

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /q/\nDisallow: /api/\n', {
        headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=3600' },
      });
    }

    if (path.startsWith('/q/')) {
      // Customer quote page: its own small entry (CV-3). The quotes module may rewrite meta tags (CV-14).
      // '/q' (not '/q.html'): asset html_handling redirects '/q.html' -> '/q', which would skip these headers.
      const page = await env.ASSETS.fetch(
        new Request(new URL('/q', url), { method: 'GET', headers: request.headers, redirect: 'manual' }),
      );
      const res = await customerPageHook(request, env, page);
      const out = new Response(res.body, res);
      out.headers.set('x-robots-tag', 'noindex, nofollow');
      out.headers.set('cache-control', 'no-store');
      return out;
    }

    if (!isAppPath(path)) return env.ASSETS.fetch(request);

    if (env.EDITION === 'hosted') {
      const res = await hostedRouter(request, env, ctx);
      return withSecurityHeaders(res, path);
    }

    const stub = workspaceStub(env, SELF_WORKSPACE_NAME);
    const res = await forward(request, stub, SELF_WORKSPACE_NAME);
    return withSecurityHeaders(res, path);
  },
} satisfies ExportedHandler<Env>;
