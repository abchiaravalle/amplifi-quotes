# Public (customer) API contract

Customer-facing. No sign-in. Base path `/api/public`. Implemented by the **quotes** module; rendered by
the **docview** frontend (`/q/:token`). Every response carries `cache-control: no-store` and
`x-robots-tag: noindex` (the Worker adds them). The token is 128 bits of randomness, base64url (22 chars).

Every body that describes the quote is a `QuoteDocument` (`src/shared/document.ts`), built from the
FROZEN sent revision through an allowlist serializer. Never internal data.

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/q/:token` | | `200 QuoteDocument` or `200 { locked: true, companyName, brand }` when an access code is set and not yet entered (CV-12) or `410 { error: { code: 'withdrawn' } }` or `404` | Records a view (CV-10) unless the caller is a signed-in member of the workspace. Sets `aq_q_<token>` cookie after unlock |
| POST | `/q/:token/unlock` | `{ code }` | `200 QuoteDocument` + cookie | 5 tries / 10 min / IP, then 429 |
| POST | `/q/:token/verify-email` | `{ email }` | `200 { sent: true }` | Only when `actions.verifyEmailFirst` (CV-7). Sends a 6-digit code, 10-minute expiry |
| POST | `/q/:token/accept` | `{ optionKey, addons: string[], signerName, signerTitle, signerEmail, poNumber, signature, signatureKind: 'typed'\|'drawn', agree: true, verifyCode? }` | `200 QuoteDocument` (with `acceptance`) | 409 if already accepted, expired, withdrawn, or the token now points at a newer revision than the client saw: send `revisionHash` header `x-aq-revision` and the server refuses a mismatch with 409 `revision_changed`. Drawn signature: PNG data URL, max 200 KB |
| POST | `/q/:token/decline` | `{ reason }` | `200 QuoteDocument` | |
| GET | `/q/:token/questions` | | `200 { questions: { id, authorName, body, createdAt, fromCustomer: boolean }[] }` | Customer-visible thread only (CV-9) |
| POST | `/q/:token/questions` | `{ name, email, body }` | `201 { id }` | Max 5,000 chars, 10 per hour per IP |
| POST | `/q/:token/request-update` | `{ name, email, message }` | `201 {}` | Only when expired (CV-11) |
| GET | `/q/:token/files/:fileId` | | file bytes | `content-disposition: attachment` except images (SEC-6) |
| GET | `/q/:token/preview.png` | | PNG | Brand link-preview card (CV-14), stored at branding save |

Errors use the standard body `{ error: { code, message } }`. Codes the page handles:
`not_found`, `withdrawn`, `expired`, `already_accepted`, `revision_changed`, `locked`, `bad_code`,
`rate_limited`, `verify_required`, `invalid`.

## Customer page HTML

`/q/:token` is served by the SPA (static assets). The page fetches `GET /api/public/q/:token`. The
link-preview meta tags (og:title, og:image) are added by the Worker for `/q/*` requests from bots: the
Worker reads the `QuoteDocument` title + brand name and injects them into `index.html` (quotes module
owns this, through `HTMLRewriter`).
