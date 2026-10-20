#!/usr/bin/env node
/** Fails when any installed production dependency is GPL or AGPL licensed (SEC-12). */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const seen = new Set();
const bad = [];

function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const dir = join(root, 'node_modules', name);
  const pj = join(dir, 'package.json');
  if (!existsSync(pj)) return;
  const p = JSON.parse(readFileSync(pj, 'utf8'));
  const lic =
    typeof p.license === 'string'
      ? p.license
      : (p.license?.type ?? (p.licenses ?? []).map((l) => l.type).join(' OR '));
  if (
    /\bA?GPL\b/i.test(lic ?? '') &&
    !/LGPL/i.test(lic ?? '') &&
    !/\bOR\b.*\b(MIT|Apache|BSD|ISC)/i.test(lic ?? '')
  ) {
    bad.push(`${name}@${p.version} (${lic})`);
  }
  for (const d of Object.keys(p.dependencies ?? {})) visit(d);
}
for (const d of Object.keys(pkg.dependencies ?? {})) visit(d);
console.log(`checked ${seen.size} production packages`);
if (bad.length) {
  console.error(`GPL/AGPL packages found:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log('licenses OK');
