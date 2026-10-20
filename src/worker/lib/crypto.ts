import { base64url, fromBase64url } from './ids';

const enc = new TextEncoder();

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (SEC-8). */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`aq-aes:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-GCM encrypt. Output: "v1.<iv b64url>.<ciphertext b64url>" (INT-8). */
export async function encryptSecret(secret: string, plaintext: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await aesKey(secret);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `v1.${base64url(iv)}.${base64url(ct)}`;
}

export async function decryptSecret(secret: string, sealed: string): Promise<string> {
  const [v, ivs, cts] = sealed.split('.');
  if (v !== 'v1' || !ivs || !cts) throw new Error('bad sealed value');
  const key = await aesKey(secret);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(fromBase64url(ivs)) },
    key,
    new Uint8Array(fromBase64url(cts)),
  );
  return new TextDecoder().decode(pt);
}

/** Show only the last 4 characters of a secret (SEC-11). */
export function maskSecret(s: string | null | undefined): string {
  if (!s) return '';
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
}
