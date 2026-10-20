#!/usr/bin/env node
/**
 * Starts `wrangler dev` on the production build for e2e tests, with a throwaway state dir and a
 * test-only E2E_SECRET that enables /api/test/* helpers (sign-in without a real authenticator).
 * Used only by playwright.config.ts webServer. Never deployed.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = process.argv[2] ?? '8799';
const state = mkdtempSync(join(tmpdir(), 'aq-e2e-'));
const vars = join(state, '.dev.vars');
writeFileSync(
  vars,
  'SETUP_CODE=e2e-setup-code-123456\nE2E_SECRET=e2e-only-secret\nINTEGRATION_KEY=e2e-integration-key\n',
);
const child = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '--local',
    '--port',
    port,
    '--inspector-port',
    String(Number(port) + 1000),
    '--persist-to',
    state,
    '--env-file',
    vars,
    '--show-interactive-dev-session=false',
  ],
  { stdio: 'inherit', env: { ...process.env, CI: '1' } },
);
const stop = () => child.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
