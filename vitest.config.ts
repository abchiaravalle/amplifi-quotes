import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

/**
 * Two test projects:
 *  - "unit": pure code (engine, shared, web helpers) in Node. Fast.
 *  - "worker": API and Durable Object tests inside workerd (TST-4), using wrangler.jsonc bindings.
 * One failing test fails `npm test`, and `npm run build` runs `npm test` (a failed test = a failed build).
 */
export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          environment: 'node',
        },
        resolve: {
          alias: {
            '@engine': new URL('./src/engine', import.meta.url).pathname,
            '@shared': new URL('./src/shared', import.meta.url).pathname,
          },
        },
      },
      {
        test: {
          name: 'web',
          include: ['tests/web/**/*.test.tsx', 'tests/web/**/*.test.ts'],
          environment: 'jsdom',
        },
        resolve: {
          alias: {
            '@engine': new URL('./src/engine', import.meta.url).pathname,
            '@shared': new URL('./src/shared', import.meta.url).pathname,
          },
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                SETUP_CODE: 'test-setup-code-123456',
                INTEGRATION_KEY: 'test-integration-key',
                HOSTED_BASE_DOMAIN: 'quotes.test',
              },
            },
          }),
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
        },
      },
    ],
  },
});
