# Auth API contract

Implemented by the **auth** module (`src/worker/modules/auth`). Used by the **web** frontend.
WebAuthn options/responses are the JSON shapes from `@simplewebauthn/server` v14 /
`@simplewebauthn/browser` v14 (`PublicKeyCredentialCreationOptionsJSON`, `RegistrationResponseJSON`,
`PublicKeyCredentialRequestOptionsJSON`, `AuthenticationResponseJSON`). The relying party id is the
request host without port; the expected origin is `https://<host>` (and `http://localhost:<port>` in
local dev).

`workspace.setupComplete` (setting) becomes `true` the moment the owner account exists. The setup wizard
(company details, region, first template) is tracked separately by `workspace.wizardDone` and does NOT
gate the API.

## First run (DEP-4, DEP-7, DEP-8). Open before setup (under `/api/setup/*`)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/setup/status` | | `{ setupComplete, reclaimAvailable, edition }` |
| POST | `/api/setup/claim` | `{ code, email, name }` | `{ challengeId, options }` (registration). 5 wrong codes per 10 min per IP then 429 |
| POST | `/api/setup/claim/verify` | `{ challengeId, response }` | `{ member, recoveryCodes: string[10] }` + session cookie |
| POST | `/api/setup/owner-invite` | (DO RPC only, hosted) | see `createOwnerInvite(email, name)` on `WorkspaceDO` |
| POST | `/api/setup/reclaim` | `{ code }` | `{ emailSent: boolean, challengeId?, options? }`. Available only when the current `SETUP_CODE` differs from the one used to claim. With email set up, sends a confirmation link first |
| POST | `/api/setup/reclaim/confirm` | `{ token }` | `{ challengeId, options }` |
| POST | `/api/setup/reclaim/verify` | `{ challengeId, response }` | `{ member }` + cookie; revokes every other owner session; audit `owner.reclaimed` |

## Sign-in

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/passkey/options` | `{ email? }` | `{ challengeId, options }` (authentication; discoverable credentials when email omitted) |
| POST | `/api/auth/passkey/verify` | `{ challengeId, response }` | `{ member }` + cookie |
| POST | `/api/auth/email-link` | `{ email }` | `200 {}` always (no account probing). 400 `email_not_configured` when no provider |
| POST | `/api/auth/email-link/verify` | `{ token }` | `{ member }` + cookie |
| POST | `/api/auth/recovery` | `{ email, code }` | `{ member, mustAddPasskey: true }` + cookie |
| GET | `/api/auth/oidc/:provider/start` | | 302 to provider (`google` / `microsoft`) |
| GET | `/api/auth/oidc/:provider/callback` | | 302 to `/` with cookie, or to `/sign-in?error=<code>` |
| GET | `/api/auth/methods` | | `{ passkey: true, emailLink: boolean, google: boolean, microsoft: boolean }` |

## Me

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/me` | | `{ member, workspace: { name, edition }, permissions: Record<Action, boolean> }` |
| GET | `/api/me/passkeys` | | `{ passkeys: { id, deviceLabel, createdAt, lastUsedAt }[] }` |
| POST | `/api/me/passkeys/options` | | `{ challengeId, options }` |
| POST | `/api/me/passkeys/verify` | `{ challengeId, response, deviceLabel }` | `{ passkey }` |
| DELETE | `/api/me/passkeys/:id` | | `{}` (refuses removing the last passkey) |
| GET | `/api/me/sessions` | | `{ sessions: { id, createdAt, lastSeenAt, userAgent, ip, current }[] }` |
| DELETE | `/api/me/sessions/:id` | | `{}` |
| POST | `/api/me/signout` | | `{}` clears cookie |
| POST | `/api/me/signout-everywhere` | | `{}` |

## Invites (AUTH-5). Permission `member.manage`

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/invites` | `{ email, name, role }` | `{ invite, link }` (emits `member.invited`; comms emails it when email is set up) |
| GET | `/api/invites` | | `{ invites }` |
| DELETE | `/api/invites/:id` | | `{}` |
| GET | `/api/invites/accept/:token` | | `{ email, name, role, workspaceName }` (public) |
| POST | `/api/invites/accept/:token/options` | | `{ challengeId, options }` (public) |
| POST | `/api/invites/accept/:token/verify` | `{ challengeId, response, deviceLabel }` | `{ member }` + cookie (public) |

## OIDC config (AUTH-4). Permission `integration.manage`

| Method | Path | Body | Response |
|---|---|---|---|
| PUT | `/api/auth/oidc/:provider` | `{ clientId, clientSecret, allowedDomains: string[], tenant? }` | `{ ok }` (secret stored encrypted, shown masked) |
| DELETE | `/api/auth/oidc/:provider` | | `{}` |
