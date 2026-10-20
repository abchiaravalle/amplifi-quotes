# Quotes API contract

Implemented by the **quotes** module (`src/worker/modules/quotes`). Used by the builder and admin
screens. Pricing runs through `src/engine` (`compileTemplate`, `priceQuote`, `runExamples`,
`checkInvariants`). Rate data comes from `ws.services.get('pricing.rateContext')`. Numbers come from
`ws.services.get('workspace.nextQuoteNumber')`.

All money and quantities are decimal strings. All routes need a signed-in member; permissions from
`src/shared/permissions.ts` (owner checks pass `recordOwnerId = quote.owner_id`).

## Templates (PRC-3, CHK-1..CHK-6). Permission `template.edit` for writes, `quote.create` for reads

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/templates` | | `{ templates: { id, key, name, status, publishedVersion, updatedAt }[] }` |
| POST | `/api/templates` | `{ key, name, doc? , starter? }` | `{ template }` (starter = key of a built-in starter template from `src/engine/templates`, installs doc + examples) |
| GET | `/api/templates/:id` | | `{ template, draftDoc, publishedVersion: { id, version, doc } \| null, examples }` |
| PUT | `/api/templates/:id/draft` | `{ doc }` | `{ compile: CompileResult, examples: ExampleResult[] }` (CHK-2: saving runs every example) |
| POST | `/api/templates/:id/check-formula` | `{ formula }` | `{ issues: Issue[] }` |
| POST | `/api/templates/:id/preview-change` | | `{ affected: { quoteId, number, oldTotal, newTotal, diff }[] }` (CHK-3: open sent quotes that would change on re-price) |
| POST | `/api/templates/:id/publish` | `{ changeNote, acceptChanges?: { exampleId, target, reason }[] }` | `{ version }` or 409 `examples_failing` with diffs. Accepting a changed number needs `template.accept_example_change` and a reason per change (audit + `example_acceptances`) |
| GET | `/api/templates/:id/versions` | | `{ versions }` |
| POST | `/api/templates/:id/archive` | | `{}` |
| GET | `/api/templates/:id/examples` | | `{ examples }` |
| POST | `/api/templates/:id/examples` | `{ name, inputs, context?, expected? }` | `{ example }` (expected computed from current draft when omitted) |
| PUT | `/api/templates/:id/examples/:exampleId` | same | `{ example }` |
| DELETE | `/api/templates/:id/examples/:exampleId` | | `{}` |
| GET | `/api/templates/starters` | | `{ starters: { key, name, description }[] }` |

## Quotes (QB, QT)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/quotes` | query: `status, owner, customer, template, from, to, minTotal, maxTotal, q, cursor, limit<=100, view` | `{ quotes: QuoteSummary[], nextCursor }` (QT-9) |
| GET | `/api/quotes/needs-action` | | `{ items: { kind, quoteId, number, title, since }[] }` (QT-10) |
| GET | `/api/quotes/views` / POST / DELETE `:id` | `{ name, filters }` | saved views (QT-9) |
| POST | `/api/quotes` | `{ templateId, customerId?, contactId?, siteId?, entityId?, title?, currency?, language?, from?: { quoteId } \| { customerLast: customerId } }` | `{ quote, revision }` (QB-8; number assigned now) |
| GET | `/api/quotes/:id` | | `{ quote, revision, result: PriceResult \| null, template: { id, version, doc }, permissions: { edit, send, approve, seeCost, override } }` (cost fields stripped unless `quote.see_cost`, QB-15) |
| PUT | `/api/quotes/:id/draft` | `{ baseVersion, inputs, letter?, scope?, terms?, title?, customerId?, contactId?, siteId?, entityId?, validFrom?, validUntil?, language?, currency?, isTest? }` | `{ quote, revision, result }` (QB-4 autosave; QB-6 409 `version_conflict` with `{ current, changedBy, changedAt, fields }` when `baseVersion` is stale; server re-prices: PRC-1 authoritative) |
| POST | `/api/quotes/:id/price` | `{ inputs }` | `{ result }` (dry run, nothing saved) |
| POST | `/api/quotes/:id/reprice` | | `{ before: PriceResult, after: PriceResult, changedLines }` (QB-16 compare against today's rates + template; nothing saved) |
| POST | `/api/quotes/:id/reprice/keep` | | `{ revision }` (new draft revision with today's rates) |
| POST | `/api/quotes/:id/submit` | | `{ quote, approval \| null }` (APR-1: rules fire -> pending_approval, else stays draft-ready) |
| POST | `/api/quotes/:id/send` | `{ message?, to?, cc? }` | `{ quote, revision, link, mailto? }` (QT-3 freeze + hash; EML-1 mailto when email off; 409 when approval needed) |
| POST | `/api/quotes/:id/revise` | | `{ revision }` (QT-4 new draft revision) |
| POST | `/api/quotes/:id/change-order` | | `{ revision }` (QT-5, admin) |
| POST | `/api/quotes/:id/withdraw` | `{ reason? }` | `{ quote }` (QT-7) |
| POST | `/api/quotes/:id/acknowledge` | | `{ quote }` (clears accepted from Needs action) |
| POST | `/api/quotes/:id/duplicate` | | `{ quote }` |
| GET | `/api/quotes/:id/revisions` | | `{ revisions: { id, number, status, total, sentAt, hash }[] }` |
| GET | `/api/quotes/:id/revisions/:revId` | | `{ revision, result }` |
| GET | `/api/quotes/:id/timeline` | | (comms module serves NTF-4) |
| POST | `/api/quotes/:id/notes` | `{ body, mentions?: memberId[] }` | `{ comment }` (QB-11 internal notes; emits `quote.mention`) |
| GET | `/api/quotes/:id/questions` / POST `:id/questions/:qid/answer` | `{ body }` | customer questions + answers (CV-9) |
| POST | `/api/quotes/:id/files` | multipart `file`, `visibility: customer\|internal` | `{ file }` (QB-12, 10 MB) |
| DELETE | `/api/quotes/:id/files/:fileId` | | `{}` |
| GET | `/api/quotes/:id/files/:fileId` | | bytes |
| POST | `/api/quotes/:id/access-code` | `{ code \| null }` | `{}` (CV-12) |
| POST | `/api/quotes/:id/examples` | `{ name }` | `{ example }` (CHK-5 save as example; `template.edit`) |
| GET | `/api/quotes/:id/document` | | `QuoteDocument` preview of the current draft (same serializer as the customer page) |
| GET | `/api/quotes/:id/internal-pdf-data` | | `{ document, internal: { cost, margin, trace } }` (PDF-6; `quote.see_cost`) |
| POST | `/api/quotes/:id/reminders` | `{ afterDays: number[], condition }` | `{ reminders }` (EML-5; comms delivers) |

## Approvals (APR). Rules: `integration.manage`? No: `template.edit` for rules; `quote.approve` for decisions

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/approval-rules` / POST / PUT `:id` / DELETE `:id` | `{ name, templateId?, kind, threshold?, itemId?, approverRole?, approverMemberId?, active }` | rules |
| GET | `/api/approvals` | query `status` | `{ approvals: { id, quoteId, number, title, reasons, requestedAt, overrides, discountSteps }[] }` (APR-3) |
| POST | `/api/approvals/:id/approve` | `{ comment? }` | `{ approval, quote }` |
| POST | `/api/approvals/:id/reject` | `{ comment }` | `{ approval, quote }` |

## Customer page (CV) and public API

See `docs/api/public.md`. The quotes module also registers `customerPageHook` (`src/worker/routing.ts`)
to inject `og:title` / `og:image` into `/q/:token` HTML (CV-14) and the `quotes.document` service.

## QuoteSummary

`{ id, number, title, status, customer: { id, name } | null, owner: { id, name }, template: { id, name }, total, currency, validUntil, updatedAt, sentAt, viewedAt, acceptedAt, isTest }`
