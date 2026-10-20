#!/usr/bin/env node
/**
 * Requirement coverage gate. Every requirement ID in SPEC.md whose phase is in scope must appear in at
 * least one test name (it(...) / test(...) / describe(...) string) under tests/ or e2e/.
 * Exits 1 listing the missing IDs. Run: node scripts/check-req-coverage.mjs [--phases P0,P1,P2,P3,P4,P5]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const arg = process.argv.find((a) => a.startsWith('--phases='));
const phases = new Set((arg ? arg.split('=')[1] : 'P0,P1,P2,P3,P4,P5').split(','));
// --prefixes=AUTH,DEP limits the check to IDs with those prefixes; --ids=PRC-1,PRC-2 to exact IDs
const prefArg = process.argv.find((a) => a.startsWith('--prefixes='));
const prefixes = prefArg ? new Set(prefArg.split('=')[1].split(',')) : null;
const idsArg = process.argv.find((a) => a.startsWith('--ids='));
const onlyIds = idsArg ? new Set(idsArg.split('=')[1].split(',')) : null;

const spec = readFileSync(join(root, 'SPEC.md'), 'utf8');
const rows = [...spec.matchAll(/^\| ([A-Z0-9]+-\d+) \|(.*)\|\s*$/gm)];
const required = [];
for (const [, id, rest] of rows) {
  if (/^(G|D)-/.test(id)) continue; // goals and defaults aren't testable requirements
  const cells = rest.split('|').map((s) => s.trim());
  const phaseCell = cells[cells.length - 1] ?? '';
  const ph = [...phaseCell.matchAll(/P\d/g)].map((m) => m[0]);
  if (prefixes && !prefixes.has(id.split('-')[0])) continue;
  if (onlyIds && !onlyIds.has(id)) continue;
  if (ph.some((p) => phases.has(p))) required.push(id);
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (e === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(test|spec)\.(ts|tsx|mjs|js)$/.test(e)) out.push(p);
  }
  return out;
}

function walkSrc(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkSrc(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const testText = [...walk(join(root, 'tests')), ...walk(join(root, 'e2e'))]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
// Only count IDs that appear inside a test/describe title string.
const titled = new Set();
for (const m of testText.matchAll(/\b(?:it|test|describe)(?:\.each\([^)]*\))?\(\s*(['"`])([\s\S]*?)\1/g)) {
  for (const id of m[2].matchAll(/\b([A-Z0-9]+-\d+)\b/g)) titled.add(id[1]);
}
let scope = required;
if (process.argv.includes('--implemented')) {
  // Only requirements the code claims (an ID mentioned under src/) must have a titled test.
  const srcText = walkSrc(join(root, 'src'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  scope = required.filter((id) => new RegExp(`\\b${id}\\b`).test(srcText));
}
const missing = scope.filter((id) => !titled.has(id));
console.log(
  `requirements in scope: ${scope.length}, covered by a titled test: ${scope.length - missing.length}`,
);
if (missing.length) {
  console.error(`MISSING (${missing.length}): ${missing.join(', ')}`);
  // --report prints progress without failing (main-branch CI while the build is in progress)
  process.exit(process.argv.includes('--report') ? 0 : 1);
}
console.log('OK');
