# Build brief (read first, every builder)

You are building one workstream of **amplifi Quotes**, a quoting app that runs on Cloudflare Workers.
The product spec is `SPEC.md` at the repo root (234 requirements with IDs like `PRC-9`, `CV-5`). Your
workstream's requirement IDs are listed in your task. Implement every one of them, each with tests.

## The one rule

**One failed test = a failed build.** `npm run build` runs typecheck, lint, the full test suite, the
web build and a dry-run deploy, and it must exit 0 on your branch before you report done. Never skip,
`.skip`, `.todo`, `.only`, or weaken a test to make it pass. Never delete someone else's test. If a test
you didn't write fails because of your change, fix your change.

## Commands

```
npm run typecheck     # tsc, strict, noUncheckedIndexedAccess
npm run lint          # biome (no `any` in src/, no eval, formatted). `npx biome check --write .` fixes format
npm test              # vitest: project "unit" (Node) + project "worker" (workerd, real Durable Objects)
npx vitest run tests/worker/your-file.test.ts   # one file
npm run build         # the gate. Must pass.
```

No `npm run dev` or any server/watch command: the tool runner blocks long-lived processes. Use tests.
Don't open browsers, play sound, or start apps with windows on this Mac.

## Architecture you must follow (don't redesign)

- `src/engine/` pure pricing engine (no I/O). Contract in `src/engine/types.ts`. Everyone else imports
  from `src/engine/index.ts` only.
- `src/shared/` code used by both server and browser: `permissions.ts` (Appendix A as data, `can()`),
  `document.ts` (the customer-facing `QuoteDocument` model: the ONLY shape the customer page, PDF and
  customer emails render from).
- `src/worker/index.ts` Worker entry. Forwards `/api/*`, `/ws`, `/widget/*` to the workspace Durable
  Object. Everything else is static assets (SPA).
- `src/worker/workspace-do.ts` one Durable Object per workspace with SQLite. ALL workspace reads and
  writes happen in it, one request at a time.
- `src/worker/app/app.ts` builds the Hono app inside the DO. Middleware already done: internal headers,
  Origin check (SEC-2), read-only guard (UPD-5), session cookie (`c.var.member`), setup gate (DEP-5).
- `src/worker/modules/<name>/index.ts` one module per workstream. Register routes in `routes(app, ws)`,
  and jobs / outbox senders / event subscribers in `init(ws)`. **You own only your module folder** plus
  the files your task names.
- `WsCtx` (`c.var.ws`): `db` (SQLite wrapper: `all/one/value/run/tx`), `clock.now()` (NEVER call
  `Date.now()` in workspace code: tests control time), `settings` (typed, `services/settings.ts`),
  `audit.log()`, `jobs.schedule()` (DO alarms), `outbox.enqueue()` (email/webhook/crm/chat delivery with
  retries), `events.emit()/on()` (in-process, synchronous, inside the caller's transaction), `live`
  (WebSocket push), `http.fetch(purpose, url, init)` (the ONLY outbound HTTP; never call global `fetch`
  from workspace code), `limiter.hit()` (exact rate limits, SEC-9), `today()`.
- `src/worker/app/session.ts`: `requireMember(c)`, `requirePermission(c, action, recordOwnerId?)`,
  `allowed()`, `createSession()`, `sessionCookie()`, `revokeSessions()`.
- Errors: throw `ApiError` helpers from `src/worker/lib/errors.ts` (`badRequest`, `forbidden`,
  `notFound`, `conflict`, `tooMany`). Error body is always `{ error: { code, message, details? } }`.
  Validate request bodies with **zod 4** (`import { z } from 'zod'`); zod errors become 400 automatically.
- IDs: `newId('qt', ws.clock.now())`, tokens: `randomToken()`, hashing: `sha256Hex()`,
  `constantTimeEqual()`, `encryptSecret()/decryptSecret()` in `src/worker/lib/`.
- Schema: `src/worker/db/migrations/0001_init.ts` has every table. **Don't edit 0001.** If you need more
  columns/tables/indexes, put the statements in YOUR slot file (`0002_auth`, `0003_data`, `0004_quotes`,
  `0005_comms`, `0006_integrations`, `0007_hosted`). Money/decimals are TEXT decimal strings, never REAL.
  Timestamps are INTEGER ms. JSON columns are TEXT.
- Free-plan budget (spec 7.9): no polling, no per-request logging to the DB, autosave at most 2 rows,
  batch imports, reports read summary rows, outbox runs <= 40 outbound calls. Every request path must
  stay well under 10 ms CPU: no password hashing, no heavy loops on the request path.
- Frontend (when your task includes UI): React 19 + react-router 7 in `src/web/`. Plain, roomy screens.
  Labels, not explainers. No decorative animation, no help-text boxes, no eyebrow labels. Respect
  `prefers-reduced-motion`. WCAG 2.2 AA.

## Tests you must write

- Worker tests live in `tests/worker/<your-area>-*.test.ts` and run inside workerd with real Durable
  Objects. Use `tests/worker/helpers.ts`: `client()`, `.get/.post/.put/.patch/.del`, `sql()` (assertions
  only), `setNow(ms)`, `runAlarm()`, `mockFetch(rules)`, `outboundCalls()`. Each test FILE gets fresh
  storage. Tests in one file share storage, so make each file self-contained (set up what it needs).
- Unit tests live in `tests/unit/<your-area>-*.test.ts` (Node).
- Every requirement ID in your task gets at least one test whose name contains the ID, e.g.
  `it('locks the setup code after 5 tries (DEP-4)', ...)`. A script will check this.
- Test the "Done when" column of the spec literally where it can be tested in code.
- Test permissions with real members of each role through the API, not by calling `can()`.
- Mock all outbound HTTP with `mockFetch()`; assert on `outboundCalls()`. Tests never reach the internet.
- Real passkeys can't be done in workerd. The auth workstream provides a test-only path (see its task).
  Other workstreams sign members in through `tests/worker/fixtures.ts` once it exists; until then, write
  your own local helper in your test file.

## Git

- Work only in your worktree on your branch. Commit early and often with clear messages.
- Don't push. Don't merge. Don't touch `main`. Don't rebase onto other branches.
- When done: `npm run build` exits 0, everything committed, then report.

## Report back (final message)

1. Requirement IDs implemented, and any you could NOT finish, with the reason.
2. Test count added and the final `npm run build` tail showing it passed.
3. Files outside your module folder that you changed, and why.
4. Anything another workstream must know (new events emitted, settings keys, routes others call).
