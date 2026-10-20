## 7. Architecture

### 7.1 Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript everywhere | One language for engine, server, and browser |
| Server | Hono on Cloudflare Workers | Small, typed routing that runs unchanged in workerd for tests |
| Data | SQLite inside one Durable Object per workspace, through Drizzle's durable-sqlite driver | Real transactions (`transactionSync`), 30-day point-in-time restore on the free plan, 10 GB per workspace, and one writer per workspace, which removes the race conditions the prototype had to fix with advisory locks |
| Directory (hosted only) | D1 | Cross-workspace lookups: domains, plans, billing |
| Live updates | WebSocket hibernation API on the workspace Durable Object | Push instead of polling; no duration charge while idle |
| Scheduled work | Durable Object alarms | Expiry, reminders, outbox delivery, daily usage counts. Uses none of the 5 free Cron Triggers |
| Front end | React with Vite, served as Worker static assets in single-page-application mode | Static asset requests are free and unlimited |
| PDF | pdfmake in the browser, loaded on demand | No server-side browser |
| Sign-in | SimpleWebAuthn (works on Workers), email links, optional OIDC | No password hashing |
| Validation | Zod 4.5 or later | Shared schemas for API and forms; Cloudflare's memory guidance names versions before 4.5 |
| Money | A decimal library (decimal.js-light or big.js), wrapped in a `Money` type | No float errors in totals |
| Tests | Vitest with `@cloudflare/vitest-pool-workers`, Playwright for end-to-end | Tests run inside workerd, the real runtime |
| License | Source-available, terms in decision D-1 | Lets anyone self-deploy, blocks resale of a hosted copy |

### 7.2 Request path

```
Browser
  |-- static assets (free, cached at the edge)
  |-- /api/*  ->  Worker: session check, rate limit, route
  |                 |-> Workspace Durable Object (SQLite)
  |                 |     pricing engine, quote state, audit log,
  |                 |     outbox, alarms, WebSocket hub
  |                 |-> email / CRM / webhook calls only from the outbox
  |-- /q/<token>  ->  Worker -> Workspace DO (read frozen revision)
  |-- /ws         ->  Worker -> Workspace DO (hibernating WebSocket)
```

The Worker stays thin: it checks the session cookie (a SHA-256 lookup), applies the rate limit, and forwards to the workspace object. All reads and writes for a workspace happen inside its Durable Object, one request at a time.

### 7.3 Repository layout

```
/                       wrangler.jsonc, package.json, .dev.vars.example
/packages/engine        pricing engine: parser, unit checker, interpreter, money, trace
/packages/schema        Drizzle tables, migrations, Zod schemas
/packages/templates     starter templates + their pricing examples
/apps/worker            Hono routes, Durable Object class, adapters
/apps/web               React app: builder, admin, customer page, PDF
/tests                  API, permission, engine, parity, load, and e2e suites
/.github/workflows      ci.yml, release.yml, update.yml
/docs                   spec, admin guide, template authoring guide
```

The Deploy to Cloudflare button needs the app at the repo root with its own dependencies, so this is one package workspace with a single root `package.json` build.

### 7.4 Adapters

The app talks to the outside through interfaces with Cloudflare versions first: `Store` (workspace SQLite), `Directory` (D1, hosted only), `Mail` (none, Cloudflare Email Service, Resend, SMTP2GO), `Files` (SQLite blobs, optional R2), `Clock`, `Live` (WebSocket hub), and `Secrets`. Tests use in-memory versions of each.

### 7.5 Data model

All tables live in the workspace database unless marked. Money columns store integers in minor units plus a currency code. Every table has `id`, `created_at`, `updated_at`, and `created_by` where it applies.

| Table | Holds |
|---|---|
| `settings` | Workspace name, brand, defaults, number format, calendar, feature switches |
| `members` | Name, email, role, status, last sign-in |
| `passkeys` | Credential id, public key, counter, device label, member |
| `sessions` | Token hash, member, created, last seen, expires, user agent |
| `invites` | Email, role, token hash, expires, used |
| `entities` | Selling entities: legal name, address, tax id, bank details |
| `customers` | Company record, defaults, tax-exempt flag |
| `contacts` | People under a customer |
| `sites` | Service locations with country and resolved region |
| `assets` | Installed assets per site with attribute values (JSON) |
| `catalog_items` | Items, labor roles, asset types; attributes as JSON validated by category schema |
| `item_prices` | Price per currency with effective dates |
| `regions` | Currency, distance unit, tax rule |
| `country_regions` | ISO country to region |
| `rates`, `rate_values` | Named rates and their per-region dated values |
| `fx_rates` | Currency pair, rate, date, source |
| `tax_rules` | Region, rate, taxable categories, label |
| `templates`, `template_versions` | Quote types; each published version is immutable and holds the compiled syntax tree |
| `pricing_examples` | Inputs and expected outputs per template version |
| `quotes` | Number, customer, owner, status, current revision, customer token, validity |
| `quote_revisions` | Inputs, computed lines, totals, trace, frozen rates and terms, template and engine version, hash, sent time |
| `quote_events` | Status changes and activity for the timeline |
| `acceptances` | Signer, option, add-ons, PO, signature, time, IP, user agent, revision hash |
| `views` | Quote, time, country, device type |
| `comments` | Internal notes and customer questions, with visibility |
| `files` | Attachments (SQLite blobs up to 1.9 MB each in chunks, or R2 keys when R2 is bound) |
| `approvals` | Rule fired, approver, decision, comment |
| `notifications` | Member, event, read state |
| `outbox` | Kind, payload, attempts, next attempt, last error |
| `webhooks`, `api_keys` | Endpoints and hashed keys with scopes |
| `audit_log` | Append-only: actor, action, target, before and after |
| `report_daily` | Summary counts and values per day, rep, template, status |
| `usage_daily` | Requests, rows read and written, storage, per day |
| `drafts` | Per-member unsaved builder state |
| (Directory, D1) `workspaces`, `domains`, `subscriptions` | Hosted edition only |

Indexes go on every foreign key and every list filter. Each write path is reviewed for rows written, because each index adds a billed row.

### 7.6 Pricing engine

The engine takes a template version, inputs, and a rate context, and returns lines, option totals, add-on amounts, tax, and a trace.

1. **Parse** formulas into syntax trees at publish time. The grammar is in Appendix B.
2. **Check units.** Each node gets a unit; mixing units fails the publish.
3. **Order.** Lines and named values form a dependency graph; a cycle fails the publish.
4. **Evaluate** with an interpreter over the stored trees, using decimal arithmetic.
5. **Round** each line to the currency's minor unit and the template's step.
6. **Discount** in the template's order, recording each step.
7. **Trace**: every node records its inputs and output, so any number can be explained.

The engine has no I/O and no clock. The caller passes in rates, exchange rates, the calendar, and "today". The browser and the Worker run the same package and have to agree to the byte (PRC-1).

### 7.7 Quote templates

A template is a versioned JSON document. A trimmed field-service example:

```json
{
  "key": "field_service",
  "name": "Repair and field service",
  "inputs": [
    { "id": "techs", "type": "integer", "label": "Technicians", "min": 1, "default": 1 },
    { "id": "onsite_days", "type": "integer", "label": "Days on site", "min": 1 },
    { "id": "drive_km", "type": "number", "label": "Round-trip distance", "unit": "distance" },
    { "id": "lodging", "type": "yesno", "label": "Overnight stay", "default": true }
  ],
  "values": {
    "room_nights": "if(lodging, techs * max(onsite_days - 1, 0), 0)"
  },
  "groups": [
    { "id": "labor", "label": "Labor", "lines": [
      { "label": "Technician time", "qty": "techs * onsite_days * 8", "unit": "hour",
        "price": "rate.technician_hourly" } ] },
    { "id": "travel", "label": "Travel", "lines": [
      { "label": "Mileage", "qty": "drive_km", "unit": "distance", "price": "rate.mileage" },
      { "label": "Lodging", "qty": "room_nights", "unit": "night", "price": "rate.lodging_night",
        "owns": "room_nights", "when": "lodging" },
      { "label": "Per diem", "qty": "techs * onsite_days", "unit": "day", "price": "rate.per_diem" } ] }
  ],
  "discountOrder": ["line", "option", "quote"]
}
```

The `owns` field enforces PRC-9: no other line can bill `room_nights` on its own. That rule targets a bug class the prototype hit: lodging nights billed from two separate inputs.

### 7.8 Carrying over the prototype's arithmetic

The prototype's math lives in a 12,500-line builder file plus a 1,989-line breakdown module. The plan:

1. Export a fixture set from the prototype: inputs and stored totals for every finalized quote type, with customer names, addresses, and contacts replaced by fakes. The fixture keeps only numbers and structure.
2. Rebuild each prototype quote type as a template.
3. Run every fixture through the new engine. Totals have to match the prototype to the cent, except where the prototype has a known, documented defect; those differences are listed with the reason and the corrected value.
4. Keep the fixtures as private regression tests. They never enter the public repo.

### 7.9 Free-plan budget

Cloudflare's free plan limits (read October 20, 2026): 100,000 Worker requests a day, 10 ms CPU per request, 50 outbound requests per invocation, and for SQLite-backed Durable Objects 100,000 requests a day, 13,000 GB-seconds of duration a day, 5 million rows read and 100,000 rows written a day, and 5 GB of storage.

Estimate for one heavy user-day (3 hours in the builder, autosave at most every 15 seconds while editing, about half that time editing): 610 requests and 780 rows written.

| People quoting all day | Requests (of 100,000) | Rows written (of 100,000) |
|---|---|---|
| 25 | 15% | 20% |
| 50 | 30% | 39% |
| 100 | 61% | 78% |
| 128 | 78% | 100% |

One workspace object active for a full 24 hours uses 10,800 GB-seconds, under the 13,000 free. A self-deployed workspace can't run out of duration on its own.

These are estimates. Phase 2 replaces them with a measured load test (TST-6), and the usage page (ADM-1) shows live counts.

Design rules that keep this true:

- No polling. One hibernating WebSocket per tab.
- No per-request logging to the database. The audit log records actions, not page loads. Request logs go to Workers Logs (200,000 a day free, kept 3 days).
- Autosave writes at most 2 rows.
- Imports batch in the browser.
- Reports read summary rows.
- Outbox runs make at most 40 outbound calls each.

### 7.10 Deploy button contract

| Item | Setting |
|---|---|
| Button URL | `https://deploy.workers.cloudflare.com/?url=<public repo URL>` |
| Resources | Worker + static assets + one SQLite Durable Object class, declared in `wrangler.jsonc` |
| Secrets | `SETUP_CODE` (required); `RESEND_API_KEY`, `SMTP2GO_API_KEY`, `TURNSTILE_SECRET`, `INTEGRATION_KEY` (optional), listed in `.dev.vars.example` with descriptions in `package.json` |
| Build | `npm run build` (Vite + Worker bundle) |
| Deploy | `npm run deploy` = `wrangler deploy`; Durable Object migrations declared in `wrangler.jsonc` |
| Requirements on the deployer | A Cloudflare account and a GitHub or GitLab account. No payment method |
| Known limits | Repo has to be public, on github.com or gitlab.com, Workers only (not Pages). Builds: 3,000 minutes a month free, 1 at a time, 20-minute timeout |

### 7.11 Hosted edition layout

One Worker serves every hosted workspace. The hostname (custom domain or `<slug>.quotes.amplifi.studio`) maps to a workspace id through the D1 directory, cached in memory per isolate. Each workspace has its own Durable Object, named by workspace id. Nothing in the directory holds quote data. Stripe webhooks update the directory. Custom domains use Cloudflare for SaaS (100 hostnames included, then $0.10 each a month).
