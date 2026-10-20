import { env, exports } from 'cloudflare:workers';
import { SELF_WORKSPACE_NAME } from '../../src/worker/index';
import type { WorkspaceDO } from '../../src/worker/workspace-do';

/**
 * Shared test helpers for workerd tests. Every worker test file gets its own isolated storage.
 *
 *   const api = client();                 // anonymous
 *   await api.get('/api/health')
 *   const owner = await setupOwner();     // finishes first-run setup, returns a signed-in client
 *   const sales = await owner.invite('sales')  // returns a signed-in client for a new member
 */
export const ORIGIN = 'https://quotes.example.com';

export function stub(): DurableObjectStub<WorkspaceDO> {
  const ns = env.WORKSPACE as unknown as DurableObjectNamespace<WorkspaceDO>;
  return ns.get(ns.idFromName(SELF_WORKSPACE_NAME));
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
  raw: Response;
}

export class Client {
  cookie = '';
  constructor(public origin = ORIGIN) {}

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<ApiResponse<T>> {
    const h: Record<string, string> = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (method !== 'GET' && method !== 'HEAD' && !('origin' in h)) h.origin = this.origin;
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (body instanceof FormData || typeof body === 'string' || body instanceof Uint8Array)
        payload = body as BodyInit;
      else {
        payload = JSON.stringify(body);
        h['content-type'] = h['content-type'] ?? 'application/json';
      }
    }
    const res = await exports.default.fetch(
      new Request(`${this.origin}${path}`, { method, headers: h, body: payload }),
    );
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = /aq_session=([^;]*)/.exec(setCookie);
      if (m) this.cookie = m[1] ? `aq_session=${m[1]}` : '';
    }
    const ct = res.headers.get('content-type') ?? '';
    const parsed = ct.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, body: parsed as T, headers: res.headers, raw: res };
  }
  get<T = any>(p: string, h?: Record<string, string>) {
    return this.request<T>('GET', p, undefined, h);
  }
  post<T = any>(p: string, b?: unknown, h?: Record<string, string>) {
    return this.request<T>('POST', p, b ?? {}, h);
  }
  put<T = any>(p: string, b?: unknown, h?: Record<string, string>) {
    return this.request<T>('PUT', p, b ?? {}, h);
  }
  patch<T = any>(p: string, b?: unknown, h?: Record<string, string>) {
    return this.request<T>('PATCH', p, b ?? {}, h);
  }
  del<T = any>(p: string, h?: Record<string, string>) {
    return this.request<T>('DELETE', p, undefined, h);
  }
}

export function client(origin?: string): Client {
  return new Client(origin);
}

/** Run SQL inside the workspace DO (assertions only; never use to set up state the API can set up). */
export async function sql<T = Record<string, unknown>>(
  query: string,
  ...params: (string | number | null)[]
): Promise<T[]> {
  return (await stub().testSql(query, ...params)) as T[];
}

export async function setNow(ms: number | null): Promise<void> {
  await stub().testSetNow(ms);
}

export async function runAlarm(): Promise<{ ran: number; failed: number }> {
  return stub().testRunAlarm();
}

export async function mockFetch(
  rules: { prefix: string; status: number; body: string; headers?: Record<string, string> }[] | null,
) {
  await stub().testMockFetch(rules);
}

export async function outboundCalls() {
  return stub().testOutboundCalls();
}
