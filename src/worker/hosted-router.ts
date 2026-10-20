import type { Env } from './env';
import { forward, workspaceStub } from './index';

/**
 * Hosted edition routing (HST-1, HST-5). Resolves the hostname to a workspace through the directory,
 * then forwards to that workspace's own Durable Object. The hosted workstream extends this
 * (sign-up, Stripe webhooks, staff console live under /api/hosted/*).
 */
export async function hostedRouter(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const dir = env.DIRECTORY.get(env.DIRECTORY.idFromName('directory')) as DurableObjectStub & {
    resolveHost(h: string): Promise<{ workspaceId: string; jurisdiction: string; status: string } | null>;
  };
  const hit = await dir.resolveHost(url.hostname);
  if (!hit) {
    return Response.json(
      { error: { code: 'unknown_workspace', message: 'No workspace at this address' } },
      { status: 404 },
    );
  }
  const stub = workspaceStub(env, hit.workspaceId, hit.jurisdiction);
  return forward(request, stub, hit.workspaceId);
}
