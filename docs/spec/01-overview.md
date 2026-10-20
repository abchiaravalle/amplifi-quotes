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
