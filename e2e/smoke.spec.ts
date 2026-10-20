import { expect, test } from '@playwright/test';

test('health endpoint and app shell load', async ({ page, request }) => {
  const h = await request.get('/api/health');
  expect(h.ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
});
