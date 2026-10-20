import { type Env, INTERNAL_HEADERS } from './env';
import { hostedRouter } from './hosted-router';

export { DirectoryDO } from './directory-do';
export { WorkspaceDO } from './workspace-do';

/** Paths the Worker handles itself; everything else is a static asset (SPA fallback). */
function isAppPath(p: string): boolean {
  return p.startsWith('/api/') || p === '/ws' || p.startsWith('/widget/') || p === '/robots.txt';
}

/** The self-deployed edition has exactly one workspace. */
export const SELF_WORKSPACE_NAME = 'workspace';

export function workspaceStub(env: Env, name: string, jurisdiction?: string): DurableObjectStub {
  const ns = jurisdiction === 'eu' ? env.WORKSPACE.jurisdiction('eu') : env.WORKSPACE;
  return ns.get(ns.idFromName(name));
}

/** Forward a request to a workspace DO with trusted internal headers (client copies stripped). */
export function forward(request: Request, stub: DurableObjectStub, workspaceId: string): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const h of Object.values(INTERNAL_HEADERS)) headers.delete(h);
  headers.set(INTERNAL_HEADERS.ip, request.headers.get('cf-connecting-ip') ?? '');
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  headers.set(INTERNAL_HEADERS.country, cf?.country ?? '');
  headers.set(INTERNAL_HEADERS.workspace, workspaceId);
  headers.set(INTERNAL_HEADERS.host, url.host);
  return stub.fetch(new Request(request, { headers }));
}

export function withSecurityHeaders(res: Response, path: string): Response {
  const r = new Response(res.body, res);
  // WebSocket upgrade responses must pass through untouched
  if (res.status === 101) return res;
  r.headers.set('x-content-type-options', 'nosniff');
  r.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  if (path.startsWith('/api/')) {
    r.headers.set('cache-control', r.headers.get('cache-control') ?? 'no-store');
    if (path.startsWith('/api/public/')) r.headers.set('x-robots-tag', 'noindex, nofollow');
  }
  return r;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /q/\nDisallow: /api/\n', {
        headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=3600' },
      });
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
