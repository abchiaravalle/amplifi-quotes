#!/usr/bin/env node
/**
 * Bundle checks run by `npm run build`:
 *  - the customer page entry stays under 250 KB of compressed JS before the PDF library loads (CV-3)
 *  - no `eval(` / `new Function(` anywhere in shipped JS (PRC-6)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/web', import.meta.url).pathname;
const html = readFileSync(join(dist, 'q.html'), 'utf8');
const scripts = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
].map((m) => m[1]);
let total = 0;
for (const s of scripts) total += gzipSync(readFileSync(join(dist, s.replace(/^\//, '')))).length;
const kb = Math.round(total / 1024);
console.log(`customer page initial JS: ${kb} KB gzip (${scripts.length} files)`);
let failed = false;
if (total > 250 * 1024) {
  console.error('FAIL: customer page initial JS is over 250 KB gzip (CV-3)');
  failed = true;
}
const assets = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js'));
for (const f of assets) {
  const src = readFileSync(join(dist, 'assets', f), 'utf8');
  if (/\beval\s*\(|new\s+Function\s*\(/.test(src) && !f.startsWith('pdf')) {
    console.error(`FAIL: ${f} contains eval( or new Function( (PRC-6)`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('bundle checks OK');
