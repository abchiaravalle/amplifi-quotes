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
