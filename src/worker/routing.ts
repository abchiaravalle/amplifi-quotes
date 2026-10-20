import { type Env, INTERNAL_HEADERS } from './env';

/** Paths the Worker handles itself; everything else is a static asset (SPA fallback). */
export function isAppPath(p: string): boolean {
  return p.startsWith('/api/') || p === '/ws' || p.startsWith('/widget/') || p === '/robots.txt';
}

/**
 * Hook for the customer page HTML (link-preview meta tags, CV-14). The quotes workstream replaces
 * this with an HTMLRewriter that reads the quote title + brand. Default: pass through.
 */
export let customerPageHook: (request: Request, env: Env, page: Response) => Promise<Response> = async (
  _r,
  _e,
  page,
) => page;
export function setCustomerPageHook(h: typeof customerPageHook): void {
  customerPageHook = h;
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
