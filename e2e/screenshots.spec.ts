import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

/**
 * Screenshot capture for the README (`npm run screenshots`). Skipped in normal e2e runs.
 * Each workstream adds its screens to SCREENS as they land. Output: docs/screenshots/<name>-<project>.png
 * Shots use the fictional demo data seeded by /api/test/seed-demo when that route exists.
 */
const SCREENS: { name: string; path: string; signedIn: boolean; waitFor?: string }[] = [
  { name: 'home', path: '/', signedIn: true, waitFor: '#root' },
];

test.skip(!process.env.SCREENSHOTS, 'screenshots run only with SCREENSHOTS=1');

for (const s of SCREENS) {
  test(`screenshot ${s.name}`, async ({ page, request, context }, info) => {
    mkdirSync('docs/screenshots', { recursive: true });
    if (s.signedIn) await signInAs(request, context, 'owner');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(s.path);
    if (s.waitFor) await expect(page.locator(s.waitFor)).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/${s.name}-${info.project.name}.png`, fullPage: false });
  });
}
