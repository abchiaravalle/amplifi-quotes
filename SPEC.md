# amplifi Quotes: Product Specification

Version 0.1 · October 20, 2026 · ACWebDev, LLC (amplifi.studio)

## 1. Summary

amplifi Quotes is a quoting tool for companies that sell services with real pricing math: labor by role, travel, lodging, per diems, tiered plans, regional rates, equipment-based pricing, parts, and recurring contracts. A sales rep builds a quote in a guided flow. Pricing rules live in settings, not code. The customer gets a branded link where they can pick an option, accept, sign, and download a PDF.

It ships two ways from one codebase:

- **Free, self-deployed.** A Deploy to Cloudflare button puts a full copy into the customer's own Cloudflare account on Cloudflare's free plan. The customer owns the data. amplifi runs nothing for them.
- **Paid, hosted by amplifi.** The same app runs as a multi-workspace service on amplifi's Cloudflare account, with custom domains, billing, and support.

The prototype is a single-company quoting system amplifi built and runs in production. It proved the workflow: 7 quote types, regional rates, approvals, revisions, a customer quote page, PDFs, and 7 languages. The prototype hard-codes its pricing (146 branches on quote type, 188 references to its tier names), so this product is a new build that carries over the prototype's behavior and its tested arithmetic, not its code structure.

## 2. Goals

| ID | Goal | Measure |
|---|---|---|
| G-1 | A non-developer deploys a working copy in one click | Fresh Cloudflare account to first saved quote in under 10 minutes, no terminal |
| G-2 | Pricing is configuration | Every prototype quote type rebuilt as a template with zero custom code |
| G-3 | Totals are always right and always explainable | Every total has a line-by-line trace. Pricing checks block any change that moves a saved example without sign-off |
| G-4 | Runs inside Cloudflare's free plan for a typical team | 50 people quoting all day fits the free daily limits with room to spare |
| G-5 | One codebase for both editions | Self-deployed and hosted builds pass the same test suite |

## 3. Principles

1. **The server decides the price.** The browser shows a live preview, the Worker recomputes on every save, and the stored result always comes from the server.
2. **Nothing changes a sent quote.** Sent revisions are frozen: prices, exchange rates, terms, and the template version.
3. **Pricing changes are tested before they publish.** Saved examples act as tests. A change that moves one needs a person to accept the new number.
4. **Customer data stays with the customer.** The self-deployed edition sends nothing to amplifi. No telemetry, no phone-home, update checks off unless the owner turns them on.
5. **Free plan first.** Every feature has a free-plan budget. Features that can't fit are optional and say so on screen.
6. **No passwords.** Sign-in uses passkeys and email links. Password hashing alone (57 to 70 ms per login, measured) breaks the free plan's 10 ms compute limit, and reused passwords are the most common breach path.
7. **Plain screens.** Labels, not explainers. No decorative animation.

## 4. Out of scope

| Item | Reason |
|---|---|
| Invoicing, payment collection after acceptance, accounting | Hand off to Stripe, QuickBooks, or the CRM. Phase 5 adds a deposit at acceptance only |
| Work orders, scheduling, dispatch | Field service platforms own this. Webhooks let them pick up accepted quotes |
| Contract lifecycle management (redlines, clause libraries) | Terms are a template per workspace. Negotiated contracts stay in the customer's legal tools |
| Inventory and stock levels | Catalog holds prices, not quantities on hand |
| Native mobile apps | The web app is phone-ready. Reps and customers both work in the browser |
| Self-hosting outside Cloudflare (Docker, on-prem) | Considered after launch. The adapter layer keeps it possible |
| Server-side headless Chrome | Cloudflare's free plan allows 10 minutes a day. PDFs and preview images render in the browser instead |

## 5. Roles

Each workspace has members with one role. The customer is not a member; they reach a quote through its link.

| Role | Can | Can't |
|---|---|---|
| Owner | Everything, including billing (hosted), deleting the workspace, restoring backups | Nothing restricted |
| Admin | Members, roles, settings, branding, integrations, API keys, all quotes | Billing, delete workspace, restore backups |
| Pricing editor | Catalog, rates, regions, templates, terms, pricing checks; publish pricing changes | Members, integrations |
| Approver | Approve or reject quotes over a threshold; view all quotes; everything Sales can do | Pricing, settings |
| Sales | Create, edit, send, and revise their own quotes; view team quotes when the workspace allows it | Approve own quotes over threshold, pricing |
| Viewer | Read all quotes and reports | Any change |
| Customer (external) | Open the quote link, pick options, accept, sign, comment, download the PDF | See internal notes, cost, margin, traces, or other quotes |

Appendix A lists every action by role.

## 6. Features

Each requirement has an ID, a test for done, and a phase (P0 to P5, defined in section 13).

### 6.1 One-click deploy and first-run setup (DEP)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| DEP-1 | The public repo README and the amplifi site carry a Deploy to Cloudflare button pointing at the repo root | Clicking it opens Cloudflare's deploy page with the project prefilled | P0 |
| DEP-2 | The deploy creates every resource the app needs from `wrangler.jsonc`: one Worker with static assets and one SQLite-backed Durable Object class. No D1, KV, R2, or Queues in the default deploy | A fresh free account deploys with no manual resource setup and no payment method | P0 |
| DEP-3 | The setup page asks for one secret, `SETUP_CODE`, with help text from `package.json` `cloudflare.bindings` | The deploy page shows the field and its description | P0 |
| DEP-4 | First visit to the deployed URL shows a setup screen. Entering the setup code lets that person create the Owner account with a passkey | Wrong code is refused and rate limited (5 tries per 10 minutes per IP); right code creates the Owner once, then the setup screen never shows again | P0 |
| DEP-5 | Until setup finishes, every route except the setup screen and static assets returns 503 | A scripted request to `/api/quotes` before setup gets 503 | P0 |
| DEP-6 | Setup wizard: company name, logo, base currency, default language, time zone, first region, and a starter template to install | Owner reaches an empty dashboard with one template installed in under 3 minutes | P1 |
| DEP-7 | Setup prints 10 one-time recovery codes for the Owner and asks them to save them | Codes work once each; used codes are refused | P1 |
| DEP-8 | Owner lockout recovery: changing `SETUP_CODE` in the Cloudflare dashboard and redeploying re-opens a "reclaim owner" screen that needs the new code plus a confirmation sent to the Owner's email if email is set up | Reclaim works with the new code; old sessions are revoked; the audit log records it | P1 |
| DEP-9 | A Settings > Domain page explains how to add a custom domain in the Cloudflare dashboard and checks that the domain resolves to the app | Page reports pass or fail for a given hostname | P1 |
| DEP-10 | The Phase 0 deploy test runs on a brand-new Cloudflare account and a brand-new GitHub account, by someone other than the developer | Time from click to first saved quote is recorded and under 10 minutes | P0 |

### 6.2 Sign-in and sessions (AUTH)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| AUTH-1 | Members sign in with a passkey (WebAuthn). No passwords exist anywhere in the product | A member with a passkey signs in on Chrome, Safari, Firefox, Edge, iOS, and Android | P0 |
| AUTH-2 | Members can register more than one passkey and remove old ones | Removing a passkey blocks sign-in with it on the next attempt | P1 |
| AUTH-3 | Email sign-in links work when an email provider is set up: one-time, 15-minute expiry, single use | A reused or expired link is refused | P1 |
| AUTH-4 | Optional sign-in with Google or Microsoft (OIDC), turned on by an Admin with their own client ID and secret | A Google Workspace user signs in and lands in the right workspace; users outside allowed domains are refused | P2 |
| AUTH-5 | Invites: an Admin creates an invite for an email and role. The app shows a copyable invite link and emails it when email is set up. Links expire after 7 days | Invitee registers a passkey from the link and gets the invited role | P1 |
| AUTH-6 | Sessions use an HttpOnly, Secure, SameSite=Lax cookie holding a random 256-bit token. The database stores only its SHA-256 hash | A database dump contains no usable session tokens | P0 |
| AUTH-7 | Sessions end after 12 hours idle or 30 days total, and on role change, member removal, or sign-out everywhere | Each case ends the session within one request | P1 |
| AUTH-8 | Members see their own active sessions and passkeys and can revoke any of them | Revoked session's next request returns 401 | P1 |
| AUTH-9 | Sign-in, invite, and recovery endpoints are rate limited per IP and per account | 20 failed attempts in 10 minutes locks that path for 15 minutes and logs it | P1 |
| AUTH-10 | Every sign-in path stays under 3 ms of Worker CPU | Measured in the free-plan load test (TST-6) | P0 |
| AUTH-11 | The admin guide shows how to put the whole app behind Cloudflare Access (free up to 50 users) for teams that want a second lock or an IP allowlist | Following the guide on a test account blocks visitors without an Access login, and the customer page path stays open | P2 |

### 6.3 Workspace, members, and branding (WS)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| WS-1 | One deployment holds one workspace in the self-deployed edition. The hosted edition holds many (HST-1) | Self-deployed has no workspace switcher | P1 |
| WS-2 | Admins add, change the role of, and remove members. Removing a member keeps their quotes and reassigns ownership to a chosen member | Removed member can't sign in; their quotes show the new owner and the history keeps the original author | P1 |
| WS-3 | Roles and permissions follow Appendix A exactly | Generated permission tests pass (TST-3) | P1 |
| WS-4 | Branding: logo (SVG or PNG), primary and accent colors, one of 6 bundled fonts, company address block, footer text | Customer page, PDF, and emails all show the brand | P1 |
| WS-5 | Several selling entities (legal names, addresses, tax IDs, bank details) per workspace; each quote picks one | PDF and customer page show the chosen entity's details | P1 |
| WS-6 | Quote number format per workspace, for example `Q-{YYYY}-{SEQ:4}`. The Durable Object hands out numbers in one transaction, so two quotes never share a number | 200 parallel creates produce 200 unique, gapless numbers | P1 |
| WS-7 | Work calendar: working days of the week and holidays, used by date math in formulas | `workdays_between` matches a hand-checked calendar for one year | P1 |
| WS-8 | Workspace settings change history: who changed what and when, with before and after values | Every settings save writes an audit entry | P1 |
| WS-9 | Entity attributes (for example travel or lodging multipliers per selling entity) usable in formulas as `entity.<attribute>` | A quote under an entity with a 1.2 travel multiplier prices travel 20% higher, and the trace shows the multiplier | P1 |

### 6.4 Customers, contacts, and sites (CUS)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| CUS-1 | Customer companies with name, billing address, tax ID, tax-exempt flag, default currency, default language, payment terms, and notes | A quote for a customer picks up these defaults | P1 |
| CUS-2 | Contacts under a customer with name, title, email, phone; one marked primary | Quote recipient defaults to the primary contact | P1 |
| CUS-3 | Sites (service locations) under a customer with address and country. Country resolves to a pricing region (RATE-4) | Picking a site sets the quote's region and rates | P1 |
| CUS-4 | Installed assets per site: asset type, model, serial number, install date, custom attributes | A quote can pull a site's assets into an asset-based line group | P2 |
| CUS-5 | Customer price agreements: a customer-specific price list or discount percent per catalog category, with start and end dates | A quote for that customer uses the agreement price and the trace shows why | P2 |
| CUS-6 | Customer search by name, contact, email, or city; results in under 300 ms with 10,000 customers | Measured on the fixture data set | P1 |
| CUS-7 | Duplicate check on create by name and email domain | Creating a near-duplicate shows the existing record first | P2 |
| CUS-8 | Customer page lists every quote for that customer with status and value | List matches the quotes table filtered by customer | P1 |
| CUS-9 | Custom fields and tags on customers (for example industry or market), usable as report filters and in formulas as `customer.<field>` | A report filtered by a tag matches a direct count; a formula reads the field | P2 |

### 6.5 Catalog and assets (CAT)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| CAT-1 | Catalog items: SKU, name, description, category, unit (each, hour, day, month, year, km, mi, or custom), price per currency, optional cost, billing frequency (one-time, monthly, quarterly, yearly), taxable flag, active flag | An item added to a quote shows the right unit, price, and frequency | P1 |
| CAT-2 | Custom attributes per category (number, text, choice, money), usable in formulas as `item.<attribute>` | A formula reading `item.pm_hours` returns the item's value | P1 |
| CAT-3 | Labor roles as a catalog type: hourly and daily rate per region, overtime and travel-time multipliers, and default lodging and per-diem flags | A labor line for a role prices from the role's regional rate | P1 |
| CAT-4 | Asset types (the general form of the prototype's machine list): attributes such as service hours per visit, replacement value, parts allowance percent | An asset-based template prices per asset from these attributes | P1 |
| CAT-5 | Bundles: a named set of items and quantities that expands into lines when added | Adding a bundle adds each line; removing it removes them together | P2 |
| CAT-6 | Price history: every price change keeps the old price with dates. Sent quotes keep the price they were sent with | Changing a price doesn't move any sent quote's total | P1 |
| CAT-7 | Catalog search by SKU, name, or attribute; 20,000 items return results in under 300 ms | Measured on fixture data | P1 |
| CAT-8 | Items can be hidden from the customer as separate lines and rolled into a parent line | Customer page and PDF show the parent line only; the trace shows both | P2 |
| CAT-9 | Parts can be linked to asset types, so the builder offers an asset's parts list first | Picking an asset type shows its linked parts at the top of the parts search | P2 |

### 6.6 Rates, regions, currency, and tax (RATE)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| RATE-1 | Rate tables: named rates (for example `technician_hourly`, `mileage`, `lodging_night`, `per_diem`) with a value per region, a unit, a currency, and an effective date | A formula `rate.lodging_night` returns the value for the quote's region and date | P1 |
| RATE-2 | Rate grid editor: rates as rows, regions as columns, inline edit, bulk paste from a spreadsheet, CSV import and export | Pasting a 50 x 10 block from Google Sheets saves 500 values in one action | P1 |
| RATE-3 | Regions with a default currency, distance unit (km or mi), and tax rule | A region in Poland quotes in PLN with km | P1 |
| RATE-4 | Country to region mapping seeded with all ISO countries; Admins assign countries to regions | Every country resolves to exactly one region or to "unassigned", which blocks quoting until set | P1 |
| RATE-5 | Exchange rates entered by hand per currency pair with a date. Optional daily fetch from a public FX source the Admin turns on; the source host shows on the outbound-hosts list | With fetch off, the app makes no FX calls | P1 |
| RATE-6 | Each sent revision freezes its exchange rates. The customer page can show a second currency using the frozen rate, with the rate and date printed | Changing today's rate doesn't move a sent quote | P1 |
| RATE-7 | Tax rules per region: rate, which categories are taxable, and display label (VAT, GST, sales tax). Tax-exempt customers skip tax | A taxable line in a 20% VAT region adds the right tax; an exempt customer pays none | P2 |
| RATE-8 | Rounding per currency (minor units) and an optional per-template rounding step for line totals (nearest 1, 5, 10, 50, 100) | Rounded totals match the configured step in every pricing example | P1 |
| RATE-9 | Distance for travel: typed in by the rep, or computed from the site address by a maps provider the Admin adds with their own key (Mapbox or Google) | With no key set, distance is a manual field and the app makes no maps calls | P2 |

### 6.7 Pricing engine (PRC)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| PRC-1 | The engine is a pure TypeScript package with no I/O, used unchanged in the browser (live preview) and in the Worker (authoritative result) | Browser and Worker produce byte-identical results for every pricing example | P0 |
| PRC-2 | Money uses decimal arithmetic, never binary floats. Line totals round to the currency's minor unit, then to the template's rounding step | `0.1 + 0.2` style errors don't appear in any example; a property test of 100,000 random quotes finds no rounding drift between line sum and total | P0 |
| PRC-3 | A quote template (quote type) defines inputs, line groups, lines, options, add-ons, discount order, and which sections the customer sees | Each prototype quote type is rebuilt as a template with no code changes (G-2) | P0 to P1 |
| PRC-4 | Input types: number, integer, money, percent, yes/no, choice, multi-choice, date, date range, text, catalog pick (item and quantity), customer site, asset list, labor list (role, people, hours or days, lodging and per-diem flags), and repeating groups of any of these | The builder renders and validates each type | P1 |
| PRC-5 | Formula language: arithmetic, comparisons, and/or/not, `if`, `min`, `max`, `round(x, step)`, `ceil`, `floor`, `abs`, `clamp`, `sum(group, expr)`, `count(group, cond)`, `lookup(table, key)`, `coalesce`, `days_between`, `workdays_between`. No loops, no user functions, max 500 nodes per formula | The parser accepts the grammar in Appendix B and rejects everything else with a line and column | P0 |
| PRC-6 | Formulas compile to a stored syntax tree at publish time and run in an interpreter. The engine never uses `eval` or `new Function` (Cloudflare Workers block both) | A code search finds neither; CI fails if either appears | P0 |
| PRC-7 | Every value carries a unit (money in a currency, hours, days, distance, count, percent). The publish check rejects mixed-unit math such as hours plus money | A template adding hours to dollars fails to publish with a clear message | P1 |
| PRC-8 | Line definition: label, group, quantity formula, unit price formula, include condition, optional cost formula, billing frequency, taxable, discountable, and customer visibility (shown, rolled into parent, internal only) | Each field works in a pricing example | P0 |
| PRC-9 | Single-source quantities: a template can mark a quantity (for example room-nights) as owned by one line. Any other line that bills the same quantity has to reference it, and the publish check fails if two lines each bill it from their own inputs | A template that bills lodging on two lines from separate inputs can't publish | P1 |
| PRC-10 | Built-in blocks so most templates need no formulas: Labor, Travel (drive legs and fixed-fare legs), Lodging, Per diem, Asset-based service, Parts, Recurring service with term, Fixed fee, and Custom lines | A Pricing editor builds the field-service template from blocks alone | P1 |
| PRC-11 | Options (good/better/best or named tiers): one quote computes every option side by side. Options change parameters such as discount percent, included hours, response-time fee percent | The customer page shows each option's total; the trace shows each option separately | P1 |
| PRC-12 | Optional add-ons the customer can tick on the quote page. Their amounts freeze at send time; ticking one adds a fixed amount and runs no formula in the customer's browser | Add-on toggles change the total by exactly the frozen amount | P1 |
| PRC-13 | Discounts at three levels (line, option, quote), each percent or fixed amount, applied in the order the template sets. The trace shows each step | Two templates with different orders produce the documented totals | P1 |
| PRC-14 | Rep overrides: a rep with permission can override a rate or price on one quote. The override shows in the trace with the original value and counts toward approval rules | An overridden quote lists every override on the approval screen | P1 |
| PRC-15 | Every computed number keeps a trace: formula, inputs with values, and result. The trace saves with each revision | Any total on a sent quote can be explained down to inputs from the saved trace alone | P0 |
| PRC-16 | Recurring pricing: monthly, quarterly, and yearly lines show per-period and term totals; the quote shows one-time and recurring subtotals apart | A 36-month contract shows monthly, yearly, and contract totals that agree | P1 |
| PRC-17 | Speed: the largest fixture quote (300 lines, 3 options) prices in under 2 ms of Worker CPU | Measured in workerd in CI | P0 |
| PRC-18 | The engine version is stored with each revision. A newer engine never changes the total of a stored revision without showing it | Opening an old revision under a new engine shows the stored total and flags any difference | P1 |

### 6.8 Pricing checks (CHK)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| CHK-1 | Pricing examples: a saved set of inputs plus the expected total of every line and every option, attached to a template | An example runs and shows pass or fail per line | P1 |
| CHK-2 | Saving a template draft runs every example. Publishing is blocked while any example fails, unless a Pricing editor accepts each changed number with a reason | The audit log records each accepted change with the reason | P1 |
| CHK-3 | Change preview: before publishing, the editor sees which open (sent, not yet accepted) quotes would change on re-price and by how much | The preview lists quote number, old total, new total, and difference | P1 |
| CHK-4 | Built-in invariant checks on every example: no negative total unless the template allows it, no quantity billed twice (PRC-9), every customer-visible line has a trace, option totals equal the sum of their lines | A template that breaks an invariant fails with the line named | P1 |
| CHK-5 | "Save as example" from any real quote in the builder | One click creates an example from the current inputs and totals | P1 |
| CHK-6 | Starter templates ship with their examples, and CI runs them on every commit | CI fails on any change to a starter template's numbers | P0 |

### 6.9 Quote builder (QB)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| QB-1 | Guided mode: one question per screen, with screens shown or hidden by earlier answers. Keyboard: Ctrl+Enter next, Shift+Enter back | A rep completes a field-service quote with the keyboard only | P1 |
| QB-2 | Full-form mode: every section on one scrolling page with a section index | Same quote completes in full-form mode with identical totals | P1 |
| QB-3 | Live total and a breakdown panel (Ctrl+B) showing the trace for the current inputs | The panel matches the server result after save | P1 |
| QB-4 | Autosave 2 seconds after the last change, at most once per 15 seconds, writing at most 2 database rows per save | Load test (TST-6) confirms the row count | P1 |
| QB-5 | If the connection drops, edits keep going into a local copy and sync on reconnect. Conflicts follow QB-6 | Pulling the network for 5 minutes loses no edits | P2 |
| QB-6 | Optimistic locking: each save sends the version it started from. A stale save gets a conflict screen showing what changed and who changed it | Two editors on one quote never overwrite each other's work without a warning | P1 |
| QB-7 | Presence: the builder shows who else has the quote open | A second viewer appears within 2 seconds | P2 |
| QB-8 | Start a quote from scratch, from a template, by duplicating an earlier quote, or from a customer's last quote | Each path opens a draft with the right defaults | P1 |
| QB-9 | Cover letter and scope text with rich text (headings, bold, lists, links, tables) and merge fields such as `{customer.name}` and `{quote.valid_until}` | Merge fields fill on the customer page and PDF; unknown fields fail validation | P1 |
| QB-10 | Terms and conditions chosen from workspace terms blocks, editable per quote with permission | The sent revision freezes the exact terms text | P1 |
| QB-11 | Internal notes and internal attachments that customers never see | Neither appears in the customer page, PDF, emails, or customer API responses | P1 |
| QB-12 | Customer attachments (spec sheets, drawings) up to 10 MB each, shown on the customer page | Customer downloads each attachment | P1 |
| QB-13 | Validity: valid-from and valid-until dates with a workspace default length | Customer page shows the dates; accept is blocked after expiry | P1 |
| QB-14 | The builder works on a phone-width screen | Full quote completes on a 390 px wide screen | P2 |
| QB-15 | Margin view for roles with cost access: cost, margin, and margin percent per line and per option | Sales without cost access never receive cost data from the API | P2 |
| QB-16 | Re-price: a rep re-runs a draft, or a copy of a sent revision, against today's rates and template version and sees old and new side by side before keeping it | The comparison lists every line whose amount changed; keeping it creates a new draft revision | P1 |

### 6.10 Quote lifecycle (QT)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| QT-1 | Statuses: Draft, Pending approval, Approved, Rejected, Sent, Viewed, Accepted, Declined, Expired, Withdrawn. Allowed moves follow Appendix C | Any move outside Appendix C returns 409 | P1 |
| QT-2 | One quote has one number and one customer link. Revisions sit under it. The customer link always shows the latest sent revision | A customer with an old link sees the newest revision and a "this quote was updated" note | P1 |
| QT-3 | Sending freezes the revision: inputs, lines, totals, trace, exchange rates, terms, template version, and engine version. A SHA-256 hash of the frozen revision is stored | Editing after send creates a new draft revision; the sent one never changes | P1 |
| QT-4 | Revising a sent quote creates a new draft revision. Sending it replaces the customer-facing revision and records the old one as superseded | Revision history shows every sent revision with its total | P1 |
| QT-5 | Revising after acceptance needs an Admin and creates a change-order revision that the customer accepts as its own step | The original acceptance record stays intact | P2 |
| QT-6 | Expiry: a Durable Object alarm moves quotes to Expired at the end of the valid-until day in the workspace time zone | A quote expires within 5 minutes of the deadline | P1 |
| QT-7 | Withdraw: the rep or an Admin can withdraw a sent quote. The link then shows "this quote is no longer available" | Accept is refused on a withdrawn quote | P1 |
| QT-8 | Status changes happen inside one Durable Object transaction with a version check, so two finalize or accept requests can't both win | 100 parallel accept attempts produce exactly one acceptance | P1 |
| QT-9 | Quote list with filters (status, owner, customer, template, date, value) and saved views | Filters return the right results on 10,000 fixture quotes in under 500 ms | P1 |
| QT-10 | "Needs action" list per member: approvals waiting on them, accepted quotes not yet acknowledged, quotes expiring in 7 days, unanswered customer questions | Each item links to the quote and clears when handled | P1 |

### 6.11 Approvals (APR)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| APR-1 | Approval rules per workspace or per template: total discount over X percent, margin under Y percent, total over Z, any rep override, or specific items present | A quote that meets any rule can't be sent until approved | P1 |
| APR-2 | Each rule names approvers by role or by person. The first approver to act decides | The approval screen shows who decided and when | P1 |
| APR-3 | Approvers see the reason the rule fired, the overrides, the discount steps, and the trace | All four appear on the approval screen | P1 |
| APR-4 | Approve or reject with a comment. Rejection returns the quote to Draft | The rep is notified with the comment | P1 |
| APR-5 | Any edit after approval clears the approval and re-runs the rules | Editing an approved quote returns it to Draft | P1 |
| APR-6 | Approvers can't approve their own quotes unless the workspace allows it | Self-approval is refused by default | P1 |
| APR-7 | Approval reminders after a set number of hours | Reminder reaches the approver in-app and by email if set up | P2 |

### 6.12 Customer quote page (CV)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| CV-1 | The customer page opens at `/q/<token>` with a 128-bit random token, no sign-in. Responses carry `noindex` and `no-store` | Tokens can't be guessed; search engines don't index pages | P1 |
| CV-2 | The page shows the brand, entity, cover letter, scope, options side by side, line groups with subtotals, add-ons, recurring and one-time totals, tax, validity, terms, attachments, and the rep's contact | Every section renders from the frozen revision | P1 |
| CV-3 | The page loads in under 1.5 seconds on a mid-range phone on 4G, with under 250 KB of JavaScript (compressed) before the PDF library loads | Lighthouse mobile run meets the target | P1 |
| CV-4 | Currency toggle between the quote currency and a second currency using the frozen rate, with the rate and date shown | Toggle changes every amount by the frozen rate | P1 |
| CV-5 | Accept: pick an option and add-ons, then enter name, title, email, PO number (optional), and a typed or drawn signature, and tick agreement to the terms | Acceptance saves all fields plus time, IP, user agent, and the revision hash | P1 |
| CV-6 | After acceptance, the page shows an acceptance certificate: who, when, which option, total, and the revision hash. The PDF includes the certificate page | Regenerating the PDF from the frozen revision gives the same hash on the certificate | P1 |
| CV-7 | Optional email check before accepting: a 6-digit code sent to the signer's email, when email is set up and the workspace turns it on | Accept is blocked until the code matches | P2 |
| CV-8 | Decline with an optional reason | The rep is notified with the reason; the quote moves to Declined | P1 |
| CV-9 | Questions: the customer posts a question on the page; the rep answers in the app; both see the thread | A question notifies the rep within 1 minute | P2 |
| CV-10 | View tracking: each open records time, country (from Cloudflare's request data, no outside lookup), and device type. Opens by signed-in members of the workspace don't count | Opening as a member adds no view; opening signed out adds one | P1 |
| CV-11 | Expired quotes show "request an updated quote", which notifies the rep | The request appears in the rep's Needs action list | P1 |
| CV-12 | Optional access code per quote for customers who want an extra lock | Without the code the page shows only the company name and a code field | P2 |
| CV-13 | Print stylesheet so browser print gives a clean document | Printing from Chrome and Safari matches the PDF layout section for section | P1 |
| CV-14 | Link preview image (for email and chat apps) comes from the workspace brand and is generated in the Admin's browser when branding is saved. No server-side rendering | Pasting a quote link in Slack shows the brand card | P2 |
| CV-15 | Content blocks: a template can include sections with text, images, and cards and no price, such as a product overview or hosting options | Content blocks render on the customer page and PDF and never change a total | P1 |

### 6.13 PDF documents (PDF)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| PDF-1 | PDFs render in the browser from the same render model as the customer page. The PDF library loads only when a PDF is requested | No server-side browser is used anywhere | P1 |
| PDF-2 | Layout: cover with brand and entity, letter, scope, options, line groups, totals, terms, attachments list, acceptance certificate when accepted | A 300-line quote renders on Letter and A4 with no clipped or overlapping content | P1 |
| PDF-3 | The PDF footer prints quote number, revision, page x of y, and the revision hash | Every page carries the footer | P1 |
| PDF-4 | The same frozen revision always produces the same PDF content | Two renders of one revision match text-for-text | P1 |
| PDF-5 | Per-workspace PDF layout choices: page size, logo position, show or hide unit prices, show or hide line detail | Each choice changes the output as described | P2 |
| PDF-6 | Internal PDF with cost and margin for roles with cost access | Internal PDF is never attached to customer emails | P2 |

### 6.14 Email (EML)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| EML-1 | With no provider set up, "Send" opens the rep's own email app with the customer, subject, and a message holding the quote link, and marks the quote Sent | The quote moves to Sent; the link works | P1 |
| EML-2 | Provider adapters: Cloudflare Email Service (on a Workers Paid plan), Resend, and SMTP2GO. Postmark and Amazon SES follow | A test send from Settings > Email succeeds on each provider | P1 to P2 |
| EML-3 | Email templates for quote sent, reminder, approval needed, accepted, declined, question, invite, and sign-in link, with merge fields and per-language versions | Each template previews with sample data before saving | P1 |
| EML-4 | Sending domain setup page shows the DNS records the provider needs and checks them | Page reports pass or fail per record | P2 |
| EML-5 | Follow-up reminders: the rep schedules reminders (for example 3 and 7 days after send if not viewed or not accepted). A Durable Object alarm sends them | Reminder stops once the customer accepts or declines | P2 |
| EML-6 | Every outgoing email goes through the outbox (INT-6) with retries and a delivery log | A provider outage delays sends; nothing is lost | P1 |
| EML-7 | Test mode: all email goes to one address the Admin sets | No customer receives mail while test mode is on | P1 |

### 6.15 Notifications and activity (NTF)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| NTF-1 | In-app notifications pushed over one WebSocket per open tab, using the Durable Object hibernation API. No polling | A notification shows in under 2 seconds; an idle tab costs no Durable Object duration | P1 |
| NTF-2 | Events: approval needed, approved, rejected, quote viewed (first view and after a gap of 24 hours), accepted, declined, question asked, expiring soon, expired, mentioned in a note | Each event reaches the right people | P1 |
| NTF-3 | Per-member preferences: in-app, email, both, or off, per event | Preferences take effect on the next event | P2 |
| NTF-4 | Activity timeline on each quote: every status change, view, email, approval, comment, and revision with time and actor | Timeline matches the audit log for that quote | P1 |
| NTF-5 | Slack and Microsoft Teams channel alerts by incoming webhook URL, per event | A test alert posts to the channel | P4 |

### 6.16 Reports (RPT)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| RPT-1 | Dashboard: quotes and value by status, sent this month, accepted this month, win rate by count and by value, average days from send to accept | Numbers match a hand count over the fixture data | P2 |
| RPT-2 | Breakdowns by rep, template, customer, region, and option picked | Each breakdown totals to the dashboard figure | P2 |
| RPT-3 | Expiring soon and stale (sent, not viewed in 7 days) lists | Lists match the quote data | P2 |
| RPT-4 | Reports read from summary rows updated on each status change, never from full scans | A report load reads fewer than 5,000 rows on the 10,000-quote fixture | P2 |
| RPT-5 | CSV export of any report | Export opens in Excel and Google Sheets with the right columns | P2 |
| RPT-6 | Test data exclusion: quotes flagged as test never count in reports | Flagging a quote as test removes it from every figure | P2 |

### 6.17 Integrations and API (INT)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| INT-1 | REST API at `/api/v1` with scoped API keys (read quotes, write quotes, read catalog, write catalog, read reports). Keys are shown once and stored hashed | A key without write scope gets 403 on writes | P4 |
| INT-2 | OpenAPI document for `/api/v1`, published with each release | Generated client compiles and passes the API tests | P4 |
| INT-3 | Webhooks for quote created, sent, viewed, accepted, declined, expired, and approval events, signed with HMAC-SHA256 and a timestamp | A receiver verifies the signature with the documented recipe | P4 |
| INT-4 | HubSpot: link a quote to a deal, push line items and the quote link, move the deal stage on accept | Accepting a test quote moves the test deal's stage | P4 |
| INT-5 | Salesforce: link a quote to an Opportunity, fill customer fields from the Account, post status events as Activities, set the stage on accept | Same as INT-4 on a Salesforce developer org | P4 |
| INT-6 | Outbox: webhooks, CRM calls, and emails go into an outbox table and a Durable Object alarm delivers them with retries at 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours, then marks them failed | Admin > Deliveries shows each attempt; a failed one can be retried by hand | P1 |
| INT-7 | Each outbox run makes at most 40 outbound requests, inside the free plan's 50 per invocation | A backlog of 500 items drains over several alarm runs | P1 |
| INT-8 | Integration secrets are encrypted at rest with AES-GCM using a key from a Worker secret | A database dump holds no readable integration tokens | P4 |

### 6.18 Instant-estimate widget (WID)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| WID-1 | A script tag the customer adds to their own website renders an estimate form in a shadow DOM, styled by data attributes and CSS custom properties | Host page CSS doesn't change the widget; the widget doesn't change the host page | P4 |
| WID-2 | The Pricing editor marks which template inputs are public and how the estimate shows: exact, rounded, or a range | The widget asks only public inputs | P4 |
| WID-3 | The estimate is computed on the server. Formulas and rates never reach the visitor's browser | The widget's network responses contain only the display amount | P4 |
| WID-4 | Turnstile is required on submit. The widget stays off until an Admin pastes a Turnstile site key and secret | Without keys the widget shows nothing and the endpoint returns 403 | P4 |
| WID-5 | Submitting creates a customer, a contact, and a draft quote with the visitor's answers, and notifies the assigned rep | The draft opens in the builder with the answers filled | P4 |
| WID-6 | Daily cap on widget estimates (default 500) and per-IP rate limit, so the widget can't use up the free plan | Calls past the cap return a friendly "try again tomorrow" message | P4 |

### 6.19 Import, export, and backup (IMP, BAK)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| IMP-1 | CSV import for catalog, rates, customers, contacts, sites, and assets. The browser parses the file, shows a preview with per-row errors, and sends rows in batches of 500 | A 20,000-row catalog imports without hitting the daily write limit warning | P1 |
| IMP-2 | Column mapping screen with saved mappings | Re-importing the same layout needs no remapping | P2 |
| IMP-3 | Full workspace export: one ZIP with JSON for every table plus files, downloadable by the Owner | The ZIP imports into an empty deployment and reproduces every quote, total, and hash | P1 |
| IMP-4 | The same export format moves a workspace between the self-deployed and hosted editions in either direction | Round trip hosted to self-deployed to hosted keeps every record | P3 |
| BAK-1 | Point-in-time restore from the Durable Object's built-in history, to any minute in the last 30 days, Owner only | Restoring to before a bulk delete brings the data back | P1 |
| BAK-2 | Before each schema migration, the app records a restore point and shows it in Settings > Backups | The restore point appears with the version it belongs to | P1 |
| BAK-3 | Optional nightly export to R2 for longer retention, off by default because R2 needs a payment method on the Cloudflare account | With R2 bound and turned on, a nightly ZIP appears in the bucket | P2 |

### 6.20 Updates (UPD)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| UPD-1 | The repo ships `.github/workflows/update.yml`. In the customer's copy it runs weekly and on demand, fetches the latest release tag from the upstream repo, and opens a pull request | A test copy receives an update pull request within one run | P1 |
| UPD-2 | An Owner setting switches the workflow to merge the update on its own when CI passes | With the setting on, a release reaches the test copy with no clicks | P1 |
| UPD-3 | Merging deploys through Workers Builds. If Phase 0 finds that pushes from the workflow don't start a build, the workflow deploys with Wrangler and a Cloudflare API token the Owner adds as a GitHub secret | Either path deploys the update | P0 to P1 |
| UPD-4 | Schema migrations live in code and run inside the Durable Object on the first request after deploy, inside one transaction, forward only | Upgrading across 5 releases on fixture data succeeds | P1 |
| UPD-5 | Downgrade guard: if the database schema is newer than the code, the app shows "restore or update" and makes no writes | Deploying an old release over a new database writes nothing | P1 |
| UPD-6 | Settings > About shows the running version and release notes. The check for newer releases is off by default; when on, it calls the GitHub releases API, listed on the outbound-hosts page | With the check off, the app makes no calls to GitHub | P1 |
| UPD-7 | Releases follow semantic versioning with a changelog. Breaking changes ship only in major versions with a migration note | Each release has notes listing migrations | P1 |

### 6.21 Hosted edition (HST)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| HST-1 | Each hosted workspace is its own Durable Object with its own SQLite database. A D1 database holds only the directory: workspaces, plans, domains, and billing state | No query can read across workspaces; the directory holds no quote data | P3 |
| HST-2 | Sign-up creates a workspace and the Owner's passkey in one flow, then runs the setup wizard (DEP-6) | New sign-up reaches an empty dashboard in under 3 minutes | P3 |
| HST-3 | Plans and billing through Stripe Checkout and the Stripe customer portal. Stripe webhooks set the plan; failed payments get a 14-day grace period, then read-only | Each state change in Stripe shows in the workspace within 1 minute | P3 |
| HST-4 | Plan limits (members, quotes per month, storage) are enforced with clear messages and never delete data | Going over a limit blocks new items only | P3 |
| HST-5 | Custom domains through Cloudflare for SaaS custom hostnames: the customer adds a CNAME and a TXT record; the app checks them and TLS is issued | A test domain serves the workspace over HTTPS | P3 |
| HST-6 | Managed email from the workspace's own domain after DNS verification, or from a shared amplifi sending domain by default | Both paths deliver to a test inbox with SPF and DKIM passing | P3 |
| HST-7 | Data location: workspaces can pick EU data location at sign-up, which creates their Durable Object in the EU jurisdiction | An EU workspace's object reports the EU jurisdiction | P3 |
| HST-8 | Support access: amplifi staff can enter a workspace only after the Owner grants time-limited access (1 to 72 hours). Every action during access is logged and visible to the Owner | Without a grant, staff tools return 403 | P3 |
| HST-9 | Workspace export (IMP-3) and full deletion are self-serve for the Owner. Deletion removes the Durable Object's data and the directory record within 30 days | A deleted test workspace's object reports zero rows | P3 |
| HST-10 | amplifi staff console: workspace list, plan, usage, status, and support-access grants. No quote content is visible without a grant | Staff console screens contain no customer quote data | P3 |
| HST-11 | Legal pages for the hosted edition: terms of service, privacy policy, data processing terms, and a list of subprocessors (Cloudflare, Stripe, the email provider) | Pages are reachable from the sign-up form and every footer | P3 |

### 6.22 Usage and administration (ADM)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| ADM-1 | Settings > Usage shows today's requests, rows written, and storage against the Cloudflare free-plan limits, counted by the app itself | Figures are within 10% of Cloudflare's own dashboard over one day | P1 |
| ADM-2 | Warnings to Admins at 70% and 90% of any daily limit, once per day each | A load test past 70% raises one warning | P1 |
| ADM-3 | Outbound-hosts page lists every host the app can call, with the setting that turns each one on. All are off by default | With defaults, a network capture over a full workday shows zero outbound calls (TST-8) | P1 |
| ADM-4 | Audit log viewer with filters by member, action, and date, and CSV export. The log is append-only and kept for 1 year | No API path updates or deletes an audit row | P1 |

### 6.23 Languages and accessibility (I18N, A11Y)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| I18N-1 | Every customer-facing string (page, PDF, emails) comes from a label set with per-workspace overrides. Lookup order: workspace override, built-in translation, English | Overriding a label changes it everywhere it shows | P1 |
| I18N-2 | Built-in customer-facing languages: English at P1; Italian, Polish, French, German, Dutch, Portuguese, and Spanish at P2 | A quote in each language shows no English strings | P1 to P2 |
| I18N-3 | Each quote has its own language; numbers, dates, and currency format by locale through the browser's `Intl` APIs | A German quote shows `1.234,56 €` style formatting | P1 |
| I18N-4 | The app interface ships in English. Interface translation files are in the repo for contributors | English covers every interface string | P1 |
| A11Y-1 | Builder, customer page, and admin screens meet WCAG 2.2 AA | axe finds no serious or critical issues; a keyboard-only pass completes every main flow | P1 to P2 |
| A11Y-2 | Reduced-motion setting is respected; no animation carries meaning | With reduced motion on, no transitions run | P1 |

### 6.24 Optional extras (EXT)

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| EXT-1 | Pay on accept: an Admin connects their own Stripe account; the customer pays a deposit (percent or fixed) or the full amount when accepting | A test-mode payment marks the acceptance paid | P5 |
| EXT-2 | Draft from a request: a rep pastes an email or RFQ text; the app fills the template inputs it can find and marks each as suggested for the rep to confirm | Suggested fields are highlighted until confirmed; nothing sends without the rep | P5 |
| EXT-3 | EXT-2 uses Workers AI within its free daily allowance, or the workspace's own AI provider key. It's off by default, shows on the outbound-hosts page, and has a monthly cap | With it off, no AI calls happen | P5 |
| EXT-4 | Starter template library: field service and repair, preventive maintenance plan with tiers, extended warranty, training and consulting, equipment with installation, parts order, IT managed services, and agency retainer | Each installs with its pricing examples passing | P1 to P2 |

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

## 8. Security

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| SEC-1 | Every API route checks the member's role inside the workspace Durable Object, not only in the Worker | Calling the Durable Object straight from a test harness with a valid session but the wrong role returns 403 (TST-3) | P1 |
| SEC-2 | Every state-changing request checks the `Origin` header against the deployment's hosts, on top of SameSite cookies | A cross-site form post is refused | P1 |
| SEC-3 | Customer-page responses go through an allowlist serializer: only fields marked customer-safe leave the server | A test that adds a new internal field to the quote finds it absent from every customer response | P1 |
| SEC-4 | Content Security Policy with no inline scripts, no `eval`, and `frame-ancestors` set to none except on the widget script | Mozilla Observatory grade A or better on the customer page | P1 |
| SEC-5 | Rich text (letters, scope, terms, comments) is sanitized on the server to an allowlist of tags and attributes | Known XSS payloads stored in each field render as text | P1 |
| SEC-6 | Uploads: size limit, type checked from file contents, served with `Content-Disposition: attachment` except images. SVG logos are sanitized before storage | An SVG with a script tag stores without the script | P1 |
| SEC-7 | Formula limits: 500 nodes per formula, 50,000 evaluation steps per quote, 1 MB of inputs per quote. Over the limit, the save fails with a message | A crafted template can't push a save past 5 ms of CPU | P0 |
| SEC-8 | Token and code comparisons use constant-time compare | Code review checklist and a lint rule cover it | P1 |
| SEC-9 | Rate limits that matter for safety (sign-in, setup code, accept, widget) count inside the Durable Object, because Cloudflare's rate-limit binding counts per location and can lag | 50 requests from different locations still hit the limit | P1 |
| SEC-10 | Webhook and integration URLs have to be `https` with a public hostname; IP literals are refused | An `http://` or IP-literal URL fails validation | P4 |
| SEC-11 | Secrets never appear in logs, errors, exports, or API responses. Settings screens show only the last 4 characters | A search of a day of Workers Logs finds no secret values | P1 |
| SEC-12 | Dependencies are pinned with a lockfile; CI runs `npm audit` and fails on high or critical findings; a license check blocks GPL and AGPL code | CI blocks a test PR that adds a GPL package | P0 |
| SEC-13 | Security events (sign-in, failed sign-in, passkey added or removed, role change, export, restore, API key created, support access) write to the audit log | Each event appears in the audit log with actor and IP | P1 |
| SEC-14 | Before the hosted edition opens, an outside reviewer tests it. The prototype's security-test findings (open CORS, missing ownership checks, non-constant-time compares, injection through string-built queries, missing authorization on status changes) form the starting checklist | Every finding is fixed or accepted in writing before launch | P3 |
| SEC-15 | `SECURITY.md` in the repo with a reporting address and a 90-day disclosure window | File present and linked from the README | P1 |

## 9. Privacy and legal

- **Self-deployed edition.** The customer runs the app in their own Cloudflare account and controls all data. amplifi receives nothing: no telemetry, no error reports, no update pings unless the Owner turns on the version check (UPD-6). Cloudflare is the customer's own provider under the customer's own Cloudflare terms.
- **Hosted edition.** ACWebDev, LLC processes workspace data for the workspace Owner. The hosted terms include a data processing agreement and a subprocessor list (Cloudflare, Stripe, the email provider). Owners can export and delete their data at any time (HST-9).
- **Personal data kept.** Members: name, email, passkeys, sessions. Customer contacts: name, title, email, phone. Signers: name, title, email, IP address, user agent, signature image or typed name. Views store country and device type only, no IP address.
- **Retention.** Quotes and acceptances stay until the workspace deletes them. Audit log: 1 year. Sessions: deleted 30 days after expiry. Workers request logs: 3 days (Cloudflare's free-plan retention).
- **Electronic acceptance.** The accept flow records the signer's identity, intent (typed name or drawing plus a terms checkbox), time, IP address, and the hash of the exact revision shown. US law (ESIGN Act and UETA) and the EU's eIDAS rules for simple electronic signatures usually accept records like this, but rules differ by country and contract type. A lawyer reviews the accept flow and hosted terms before the hosted edition opens. This document isn't legal advice.
- **Cookies.** The app sets one session cookie for members and none for customers viewing a quote. No consent banner is needed for the app itself; the hosted marketing site handles its own.

## 10. Editions and plans

| | Self-deployed (free) | Hosted Team | Hosted Business |
|---|---|---|---|
| Price | $0 | $49 per month | $149 per month |
| Where it runs | Customer's own Cloudflare account | amplifi's Cloudflare account | amplifi's Cloudflare account |
| Members | Unlimited | Up to 10 | Unlimited |
| Features | All | All except SSO and EU data location | All |
| Custom domain | Customer adds it in Cloudflare | Included | Included |
| Email sending | Customer's provider key, or the rep's own email app | Included (shared domain or their own) | Included |
| Backups | 30-day restore (built in) | 30-day restore plus nightly export | Same, plus 1-year export retention |
| Support | GitHub issues | Email, 2 business days | Email, 1 business day |
| Setup service | Quoted per job | Quoted per job | Quoted per job |

Setup service: amplifi builds the customer's templates, catalog, rates, and pricing examples from their price sheets.

## 11. Costs

**Self-deployed.** $0 for typical teams. Costs appear only if the customer chooses them: Cloudflare Workers Paid ($5 a month) above the free limits or to send email through Cloudflare; an email provider past its free tier (Resend free: 3,000 a month, 100 a day; SMTP2GO free: 1,000 a month, 200 a day); R2 for long-term exports, which needs a payment method on the Cloudflare account even inside the free allowance.

**amplifi, for the free edition.** $0. The public repo, the button, and the update workflow cost nothing to run.

**amplifi, for the hosted edition.** Workers Paid at $5 a month includes 10 million requests, 30 million CPU milliseconds, 1 million Durable Object requests, 400,000 GB-seconds of Durable Object duration, 50 million rows written, and 3,000 emails a month. Estimate for 100 workspaces with 5 heavy users each on 22 workdays:

| Item | Per month |
|---|---|
| Workers Paid base plan | $5.00 |
| Durable Object duration* | $106.38 |
| Durable Object requests | $0.86 |
| CPU | $0.21 |
| Email (15,000 sent) | $4.20 |
| **Total** | **$116.65** |
| Per workspace | $1.17 |

\* Worst case: assumes each workspace's object stays awake 9 hours every workday. Hibernating WebSockets should cut this; the Phase 2 load test measures it.

Custom domains: 100 included, then $0.10 each a month. Stripe fees apply per payment at Stripe's standard rates.

## 12. Testing

| ID | Requirement | Done when | Phase |
|---|---|---|---|
| TST-1 | Engine unit tests for every function in Appendix B plus property tests (random quotes, line sum equals total, rounding stable) | 100% branch coverage on the engine package | P0 |
| TST-2 | Prototype parity suite: anonymized prototype quotes rebuilt under the new templates match the prototype's stored totals to the cent, or appear on a documented-differences list with the reason | Every fixture passes or is listed | P0 to P1 |
| TST-3 | Permission tests generated from Appendix A: every action by every role, expected allow or deny | A change to Appendix A without matching code fails CI | P1 |
| TST-4 | API tests run inside workerd through `@cloudflare/vitest-pool-workers` | Suite passes on every pull request | P0 |
| TST-5 | End-to-end tests in Chrome, Safari (WebKit), and Firefox: build a quote, send it, open the customer page, accept, download the PDF | Suite passes on every release | P1 |
| TST-6 | Free-plan load test: replay 50 heavy user-days against a free account, then measure requests, rows read and written, Durable Object duration, and Worker CPU | Every endpoint's 99th-percentile CPU stays under 8 ms; daily totals stay under 50% of each free limit | P2 |
| TST-7 | Deploy test on a brand-new Cloudflare account and GitHub account by someone other than the developer, every minor release | Click to first saved quote in under 10 minutes | P0, then every release |
| TST-8 | Zero-outbound test: a network capture over a scripted workday with default settings | Zero outbound connections | P1 |
| TST-9 | Upgrade test: install the last 5 releases in order on fixture data, then the new one | All migrations run; totals and hashes unchanged | P1 |
| TST-10 | Browser and Worker engine parity on every pricing example | Byte-identical results | P0 |
| TST-11 | Accessibility checks with axe on every screen in CI, plus a manual keyboard and screen-reader pass per release | No serious or critical axe findings | P1 |
| TST-12 | Customer page performance budget in CI (CV-3) | Lighthouse mobile score 90 or above | P1 |
| TST-13 | Two blind reviews of the customer page and PDF by people outside the build, before each major release | Both reviews' findings fixed or accepted in writing | P1 |

## 13. Phases

| Phase | Weeks | Scope | Exit test |
|---|---|---|---|
| P0 | 1 | Repo, `wrangler.jsonc`, Durable Object with SQLite, setup code and passkey Owner, engine core (parser, interpreter, money, trace), field-service template, 20 or more prototype fixtures, Deploy button | Fresh-account deploy under 10 minutes by a non-developer; every fixture matches the prototype to the cent or is a documented defect. Either test can stop the project |
| P1 | 6 to 9 | Settings-based pricing (catalog, rates, regions, templates, blocks, options, discounts, pricing checks), builder, lifecycle, approvals, customer page with accept, PDF, email adapters, notifications, export and restore, update workflow, usage page, English labels | Self-deployed v1.0 released as a public repo; TST-1 to TST-5 and TST-7 to TST-13 pass |
| P2 | 2 to 3 | Reports, 7 more languages, assets and bundles, customer price agreements, reminders, offline edits, presence, margin view, more starter templates, load test | TST-6 passes; v1.1 released |
| P3 | 3 to 5 | Hosted edition: directory, sign-up, Stripe, plan limits, custom domains, managed email, EU data location, support access, staff console, legal pages, outside security review | Security review findings closed; first 3 hosted pilot workspaces live |
| P4 | 2 to 3 | API, OpenAPI, webhooks, HubSpot, Salesforce, Slack and Teams alerts, instant-estimate widget | Integration tests pass against HubSpot and Salesforce developer accounts |
| P5 | 1 to 2 | Pay on accept, draft from a pasted request | Test-mode payments and suggested-field flow pass end to end |

Total: 15 to 23 weeks. Self-deployed v1.0 ships at the end of P1, in week 7 to 10.

## 14. Success measures

| Measure | Target |
|---|---|
| Deploy time, click to first saved quote | Under 10 minutes for 9 of 10 first-time testers |
| Prototype parity | Every fixture matches or is documented |
| Pricing correctness after launch | Zero reported total errors that the trace can't explain |
| Free-plan fit | A 50-person team stays under 50% of every daily limit |
| Customer page speed | Under 1.5 seconds on a mid-range phone on 4G |
| Hosted pilots | 3 pilot workspaces sending real quotes by the end of P3 |

The self-deployed edition has no telemetry, so its usage isn't measured. GitHub stars, forks, and issues are the only public signal.

## 15. Risks

| Risk | Effect | Response |
|---|---|---|
| The button needs a GitHub or GitLab account | Non-technical buyers stall at the GitHub step | Hosted edition for that buyer; a screenshot guide for the button path |
| Cloudflare changes free limits or button behavior | Self-deployed copies hit limits or new deploys fail | Usage page and warnings; adapters keep a move to Workers Paid a setting, not a rebuild; TST-7 every release |
| Update workflow can't trigger a build in the customer's copy | Copies fall behind | P0 tests both paths in UPD-3 |
| Template authoring is too hard for customers | Teams never get past setup | Blocks (PRC-10), starter templates, setup service |
| Public source invites copies | Someone hosts it as a competing service | License (D-1) forbids offering it as a hosted service |
| Email from the free edition lands in spam | Customers miss quotes | Default send opens the rep's own email app (EML-1) |
| E-signature rules differ by country | Some acceptances may not hold up | Lawyer review before hosted launch; audit trail on every acceptance |
| Prototype fixtures leak client data | Breach of trust with the source client | Fixtures stripped to numbers and structure, kept in a private repo, never in the public one |
| Durable Object single writer per workspace | Very large teams queue | Soft limit is 1,000 requests a second per object, far above any quoting team |

## 16. Defaults set in this version

| ID | Default |
|---|---|
| D-1 | License: Elastic License 2.0. Free to use, change, and self-deploy; not allowed to offer as a hosted service |
| D-2 | Repo: `github.com/abchiaravalle/amplifi-quotes`, public from October 20, 2026 |
| D-3 | Product name: amplifi Quotes, pending a trademark check |
| D-4 | Self-deployed copies get every feature; hosted plans charge for hosting, domains, email, backups, and support |
| D-5 | Hosted plans and prices as in section 10 |
| D-6 | The hosted edition runs under ACWebDev, LLC on amplifi's Cloudflare account on Workers Paid |
| D-7 | Workspace data lives in one SQLite Durable Object per workspace; D1 only for the hosted directory |
| D-8 | Sign-in uses passkeys and email links, with optional Google or Microsoft sign-in. No passwords |
| D-9 | Prototype parity fixtures stay private |
| D-10 | The P0 deploy test runs on a brand-new Cloudflare account and GitHub account |

## Appendix A. Permissions

O = Owner, A = Admin, P = Pricing editor, Ap = Approver, S = Sales, V = Viewer, C = Customer (through the quote link). "own" means quotes the member owns; "team" means all quotes when the workspace setting "Sales see team quotes" is on.

| Action | O | A | P | Ap | S | V | C |
|---|---|---|---|---|---|---|---|
| Create quote | yes | yes | yes | yes | yes | no | no |
| Edit draft | yes | yes | own | yes | own | no | no |
| View quotes | all | all | all | all | own, team | all | linked revision only |
| Send quote | yes | yes | own | yes | own | no | no |
| Revise sent quote | yes | yes | own | yes | own | no | no |
| Revise accepted quote (change order) | yes | yes | no | no | no | no | no |
| Withdraw quote | yes | yes | own | yes | own | no | no |
| Approve or reject | yes | yes | no | yes, not own | no | no | no |
| Override a price or rate on a quote | yes | yes | yes | yes | if allowed | no | no |
| See cost and margin | yes | yes | yes | if allowed | if allowed | if allowed | no |
| Accept, decline, ask a question | no | no | no | no | no | no | yes |
| Edit catalog, rates, regions, tax | yes | yes | yes | no | no | no | no |
| Edit and publish templates | yes | yes | yes | no | no | no | no |
| Accept a changed pricing example | yes | yes | yes | no | no | no | no |
| Manage customers and contacts | yes | yes | yes | yes | yes | no | no |
| Manage members and roles | yes | yes | no | no | no | no | no |
| Branding, entities, email templates | yes | yes | no | no | no | no | no |
| Integrations, API keys, webhooks | yes | yes | no | no | no | no | no |
| View reports | yes | yes | yes | yes | own | yes | no |
| View audit log | yes | yes | no | no | no | no | no |
| Export workspace | yes | no | no | no | no | no | no |
| Restore backup | yes | no | no | no | no | no | no |
| Billing (hosted) | yes | no | no | no | no | no | no |
| Grant support access (hosted) | yes | no | no | no | no | no | no |
| Delete workspace | yes | no | no | no | no | no | no |

## Appendix B. Formula grammar

```
expr       := or
or         := and ( "or" and )*
and        := not ( "and" not )*
not        := "not" not | compare
compare    := sum ( ( "=" | "!=" | "<" | "<=" | ">" | ">=" ) sum )?
sum        := product ( ( "+" | "-" ) product )*
product    := unary ( ( "*" | "/" ) unary )*
unary      := "-" unary | primary
primary    := number | string | "true" | "false"
            | ref | call | "(" expr ")"
ref        := name ( "." name )*
call       := name "(" ( expr ( "," expr )* )? ")"
number     := digits ( "." digits )?
string     := '"' chars '"'
name       := letter ( letter | digit | "_" )*
```

**References.** `input.<id>`, bare input ids, `values.<id>`, `rate.<name>`, `item.<attribute>`, `entity.<attribute>`, `customer.<field>`, `site.<field>`, `option.<parameter>`, `quote.<field>` (for example `quote.valid_from`), `today`.

**Functions.** `if(cond, a, b)`, `min(a, b, ...)`, `max(a, b, ...)`, `round(x, step)`, `ceil(x)`, `floor(x)`, `abs(x)`, `clamp(x, lo, hi)`, `sum(group, expr)`, `count(group, cond)`, `lookup(table, key)`, `coalesce(a, b, ...)`, `days_between(d1, d2)`, `workdays_between(d1, d2)`.

**Limits.** 500 nodes per formula, no recursion, no user-defined functions, no loops outside `sum` and `count` over a repeating group. Division by zero is a publish-time error when the divisor is a constant and a runtime line error otherwise, shown in the builder and blocking send.

## Appendix C. Quote status moves

| From | To | Who or what |
|---|---|---|
| Draft | Pending approval | Rep submits and an approval rule fires |
| Draft | Sent | Rep sends and no rule fires |
| Pending approval | Approved | Approver |
| Pending approval | Rejected | Approver |
| Approved | Sent | Rep |
| Approved | Draft | Any edit (APR-5) |
| Rejected | Draft | Rep edits |
| Sent | Viewed | Customer opens the link |
| Sent or Viewed | Accepted | Customer accepts |
| Sent or Viewed | Declined | Customer declines |
| Sent or Viewed | Expired | Expiry alarm |
| Sent or Viewed | Withdrawn | Rep or Admin |
| Sent, Viewed, Declined, or Expired | Draft (new revision) | Rep revises |
| Accepted | Draft (change-order revision) | Admin (QT-5) |

Every move writes a `quote_events` row and an audit entry in the same transaction.

## Appendix D. Sources

Checked October 20, 2026.

| Fact | Source |
|---|---|
| Workers free plan: 100,000 requests a day, 10 ms CPU, 50 subrequests; Paid $5 a month | developers.cloudflare.com/workers/platform/limits, /workers/platform/pricing |
| Static asset requests are free and unlimited | developers.cloudflare.com/workers/static-assets/billing-and-limitations |
| Deploy to Cloudflare button behavior and limits | developers.cloudflare.com/workers/platform/deploy-buttons |
| Workers Builds: 3,000 minutes a month free, 1 concurrent, 20-minute timeout | developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing |
| Durable Objects free plan: SQLite only; 100,000 requests and 13,000 GB-seconds a day; 5 million rows read, 100,000 written; 5 GB | developers.cloudflare.com/durable-objects/platform/pricing, /durable-objects/platform/limits |
| Durable Object point-in-time restore, 30 days; transactions through `transactionSync` | developers.cloudflare.com/durable-objects/api/sqlite-storage-api |
| WebSocket hibernation: no duration charge while hibernating | developers.cloudflare.com/durable-objects/best-practices/websockets |
| Durable Objects EU jurisdiction | developers.cloudflare.com/durable-objects/reference/data-location |
| D1 free plan: 10 databases, 500 MB each, 100,000 rows written a day | developers.cloudflare.com/d1/platform/limits, /d1/platform/pricing |
| Email Service: arbitrary recipients need Workers Paid; 3,000 a month included | developers.cloudflare.com/email-service/platform/pricing |
| Browser Rendering free plan: 10 minutes a day | developers.cloudflare.com/browser-rendering/platform/pricing |
| Workers block `eval` and `new Function` | developers.cloudflare.com/workers/runtime-apis/web-standards |
| Rate Limiting binding counts per location and can lag | developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit |
| Workers Logs free: 200,000 a day, 3-day retention | developers.cloudflare.com/workers/observability/logs/workers-logs |
| Cron Triggers: 5 per account on free | developers.cloudflare.com/workers/platform/limits |
| Cloudflare for SaaS: 100 hostnames included, $0.10 each after | developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans |
| Turnstile free: 20 widgets, 10 hostnames each | developers.cloudflare.com/turnstile/plans |
| R2 needs a payment method even within the free allowance | community.cloudflare.com/t/why-using-r2-free-tier-involves-giving-card-info/945179 |
| Cloudflare Access free up to 50 users | community.cloudflare.com/t/what-happens-if-i-exceed-50-users/479340 |
| Resend free: 3,000 a month, 100 a day | resend.com/docs/knowledge-base/account-quotas-and-limits |
| SMTP2GO free: 1,000 a month, 200 a day | support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan |
| SimpleWebAuthn runs on Cloudflare Workers | jsr.io/@simplewebauthn |
| Drizzle durable-sqlite driver | orm.drizzle.team/docs/get-started/do-new |
| Pushes made with `GITHUB_TOKEN` don't start new workflow runs | docs.github.com/en/actions/concepts/security/github_token |
| Password check cost: bcrypt cost 10 at 57 ms (native) and 70 ms (pure JS); passkey signature check 0.08 ms | Measured on an Apple M1 Max, October 20, 2026 |
