/** Random ids and tokens. Uses crypto.getRandomValues only. */

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford-ish base32, lowercase, no i/l/o/u

/** Sortable-ish id: 10 chars of time + 16 random chars, with a type prefix. e.g. "qt_01h9...". */
export function newId(prefix: string, nowMs: number = Date.now()): string {
  let t = nowMs;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let rand = '';
  for (const b of bytes) rand += ALPHABET[b % 32];
  return `${prefix}_${time}${rand}`;
}

/** URL-safe random token with `bytes` bytes of entropy (default 32 = 256 bits). */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

/** Numeric code, e.g. 6-digit email verification. */
export function randomDigits(n: number): string {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (x) => String(x % 10)).join('');
}

export function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
