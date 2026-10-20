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
