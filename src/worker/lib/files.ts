import type { Clock } from '../app/types';
import type { Db } from '../db/sql';
import { sha256Hex } from './crypto';
import { badRequest } from './errors';
import { newId } from './ids';
import { sanitizeHtml } from './sanitize';

/**
 * File storage in workspace SQLite (chunked under the 2 MB row limit) with upload checks (SEC-6).
 * Optional R2 when the FILES binding exists is handled by the platform workstream (BAK-3).
 */
export const CHUNK_BYTES = 1_900_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // QB-12

export type Purpose = 'quote_customer' | 'quote_internal' | 'brand' | 'content' | 'import' | 'export';

const SIGNATURES: { mime: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { mime: 'image/webp', test: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { mime: 'application/pdf', test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { mime: 'application/zip', test: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
];

/** Detect the real type from contents. SVG and CSV/text are detected by content shape. */
export function sniffMime(bytes: Uint8Array, declaredName: string): string | null {
  for (const s of SIGNATURES)
    if (s.test(bytes)) {
      // docx/xlsx are zip containers
      if (s.mime === 'application/zip') {
        if (/\.docx$/i.test(declaredName))
          return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (/\.xlsx$/i.test(declaredName))
          return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
      return s.mime;
    }
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 2048))
    .trimStart()
    .toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  // text: no NUL bytes in the first 8 KB
  const sample = bytes.slice(0, 8192);
  if (!sample.includes(0)) return /\.csv$/i.test(declaredName) ? 'text/csv' : 'text/plain';
  return null;
}

/** Strip scripts, event handlers, foreign objects and external refs from an SVG (SEC-6). */
export function sanitizeSvg(svg: string): string {
  let s = svg;
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/<script[^>]*\/>/gi, '');
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '');
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|xlink:href)\s*=\s*("|')\s*(javascript:|data:text\/html)[^"']*\2/gi, '');
  s = s.replace(/<!ENTITY[\s\S]*?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  return s;
}

const ALLOWED_BY_PURPOSE: Record<Purpose, RegExp> = {
  brand: /^image\/(png|jpeg|svg\+xml|webp)$/,
  content: /^image\/(png|jpeg|gif|webp|svg\+xml)$/,
  quote_customer:
    /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/(plain|csv)|application\/vnd\.openxmlformats.*)$/,
  quote_internal:
    /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/(plain|csv)|application\/vnd\.openxmlformats.*)$/,
  import: /^text\/(csv|plain)$/,
  export: /^application\/zip$/,
};

export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
}

export async function storeFile(
  db: Db,
  clock: Clock,
  input: {
    name: string;
    bytes: Uint8Array;
    purpose: Purpose;
    quoteId?: string | null;
    createdBy?: string | null;
  },
): Promise<StoredFile> {
  if (input.bytes.byteLength === 0) throw badRequest('Empty file');
  if (input.bytes.byteLength > MAX_FILE_BYTES) throw badRequest('File is larger than 10 MB');
  let mime = sniffMime(input.bytes, input.name);
  if (!mime || !ALLOWED_BY_PURPOSE[input.purpose].test(mime)) throw badRequest('File type not allowed');
  let bytes = input.bytes;
  if (mime === 'image/svg+xml') {
    const clean = sanitizeSvg(new TextDecoder().decode(bytes));
    bytes = new TextEncoder().encode(clean);
    mime = 'image/svg+xml';
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters from file names
  const name = input.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 200) || 'file';
  const sha = await sha256Hex(bytes);
  const id = newId('fil', clock.now());
  db.tx(() => {
    db.run(
      `INSERT INTO files(id, quote_id, purpose, name, mime, size, sha256, storage, created_by, created_at)
       VALUES (?,?,?,?,?,?,?, 'sqlite', ?, ?)`,
      id,
      input.quoteId ?? null,
      input.purpose,
      name,
      mime,
      bytes.byteLength,
      sha,
      input.createdBy ?? null,
      clock.now(),
    );
    for (let i = 0, idx = 0; i < bytes.byteLength; i += CHUNK_BYTES, idx++) {
      db.run(
        'INSERT INTO file_chunks(file_id, idx, data) VALUES (?,?,?)',
        id,
        idx,
        bytes.slice(i, i + CHUNK_BYTES),
      );
    }
  });
  return { id, name, mime, size: bytes.byteLength, sha256: sha };
}

export function readFile(
  db: Db,
  id: string,
): {
  meta: StoredFile & { purpose: Purpose; quoteId: string | null };
  bytes: Uint8Array<ArrayBuffer>;
} | null {
  const meta = db.one<{
    id: string;
    name: string;
    mime: string;
    size: number;
    sha256: string;
    purpose: Purpose;
    quote_id: string | null;
  }>('SELECT id, name, mime, size, sha256, purpose, quote_id FROM files WHERE id=?', id);
  if (!meta) return null;
  const chunks = db.all<{ data: ArrayBuffer }>(
    'SELECT data FROM file_chunks WHERE file_id=? ORDER BY idx',
    id,
  );
  const out = new Uint8Array(meta.size);
  let off = 0;
  for (const c of chunks) {
    const part = new Uint8Array(c.data);
    out.set(part, off);
    off += part.byteLength;
  }
  return {
    meta: {
      id: meta.id,
      name: meta.name,
      mime: meta.mime,
      size: meta.size,
      sha256: meta.sha256,
      purpose: meta.purpose,
      quoteId: meta.quote_id,
    },
    bytes: out,
  };
}

/** Response for a stored file: images inline, everything else as an attachment (SEC-6). */
export function fileResponse(f: {
  meta: { name: string; mime: string };
  bytes: Uint8Array<ArrayBuffer>;
}): Response {
  const inline = /^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(f.meta.mime);
  const disp = `${inline ? 'inline' : 'attachment'}; filename="${f.meta.name.replace(/"/g, '')}"`;
  const headers: Record<string, string> = {
    'content-type': f.meta.mime,
    'content-disposition': disp,
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=300',
  };
  if (f.meta.mime === 'image/svg+xml')
    headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'";
  return new Response(new Uint8Array(f.bytes), { headers });
}

export { sanitizeHtml };
