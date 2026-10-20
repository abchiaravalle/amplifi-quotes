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
