import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (TST-5) against a local `wrangler dev` of the production build.
 * Headless only. Each run starts with fresh local state (--persist-to a temp dir).
 */
const PORT = 8799;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  forbidOnly: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['iPhone 15'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `node scripts/e2e-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
