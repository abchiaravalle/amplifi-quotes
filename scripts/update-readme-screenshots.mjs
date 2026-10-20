#!/usr/bin/env node
/**
 * Rewrites the README screenshots block from the files in docs/screenshots/.
 * Order follows SCREEN_ORDER; desktop (chromium) and phone (mobile) shots sit side by side.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'docs', 'screenshots');
const CAPTIONS = {
  home: 'Dashboard',
  builder: 'Quote builder with the live trace',
  'customer-page': 'Customer quote page',
  accept: 'Accept and sign',
  certificate: 'Acceptance certificate',
  templates: 'Template editor and pricing checks',
  rates: 'Rate grid',
  approvals: 'Approval queue',
  reports: 'Reports',
  settings: 'Settings',
  setup: 'First-run setup',
};
const SCREEN_ORDER = Object.keys(CAPTIONS);

const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : [];
const names = [...new Set(files.map((f) => f.replace(/-(chromium|mobile)\.png$/, '')))].sort(
  (a, b) => (SCREEN_ORDER.indexOf(a) + 1 || 999) - (SCREEN_ORDER.indexOf(b) + 1 || 999),
);
let block;
if (names.length === 0) {
  block =
    "_Screens land here as each part of the app is built. They're captured by the test suite\n(`npm run screenshots`), not mocked up._";
} else {
  block = names
    .map((n) => {
      const desk = files.includes(`${n}-chromium.png`)
        ? `<img src="docs/screenshots/${n}-chromium.png" width="640" alt="${CAPTIONS[n] ?? n}, desktop">`
        : '';
      const phone = files.includes(`${n}-mobile.png`)
        ? `<img src="docs/screenshots/${n}-mobile.png" width="200" alt="${CAPTIONS[n] ?? n}, phone">`
        : '';
      return `**${CAPTIONS[n] ?? n}**\n\n<p>${desk} ${phone}</p>`;
    })
    .join('\n\n');
}
const readme = join(root, 'README.md');
const src = readFileSync(readme, 'utf8');
const out = src.replace(
  /<!-- screenshots:start -->[\s\S]*?<!-- screenshots:end -->/,
  `<!-- screenshots:start -->\n${block}\n<!-- screenshots:end -->`,
);
writeFileSync(readme, out);
console.log(`README screenshots: ${names.length} screens`);
