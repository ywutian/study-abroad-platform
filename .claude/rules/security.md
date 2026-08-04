---
description: 'Security patterns and authentication rules'
globs:
  ['**/auth/**', '**/guards/**', '**/vault/**', '**/common/guards/**', '**/common/interceptors/**']
---

# Security Rules

## Role Hierarchy

`ADMIN` > `VERIFIED` > `USER`. ADMIN overrides all checks.

## Authentication

- JWT strategy validates user existence and `isBanned` status
- Token refresh uses `$transaction` to prevent race conditions
- Login always runs `bcrypt.compare` even for non-existent users (prevents email enumeration)
- Brute force: Lua script for atomic INCR+EXPIRE (prevents permanent lockout on crash)

## Frontend Token Storage

- Access token: **in-memory only** (Zustand store) — never localStorage
- Refresh token: **httpOnly cookie** — inaccessible to JS
- Guard localStorage access: `typeof window !== 'undefined'` + try-catch for SSR

## Input Sanitization

- SanitizeInterceptor handles root-level arrays + enforces depth limit (stack overflow protection)
- Validate UUID format for client-supplied `x-correlation-id` (log injection prevention)

## CSP

CSP logic lives in `lib/security/csp.ts`, pinned by `lib/security/csp.test.ts`.

- **`'unsafe-eval'` is dev-only — production must NEVER include it** (prod uses the narrower `'wasm-unsafe-eval'`).
- **Prod `script-src` carries a per-request `'nonce-…'`.** Any CSP3 browser ignores `'unsafe-inline'` once a nonce is present, so the `'unsafe-inline'` still listed after it is only the CSP2-only fallback — never the modern behaviour. Adding a new inline `<script>` therefore MUST pass the nonce (`headers().get('x-nonce')` in a server component, or the library's own `nonce` prop — that is why `ThemeProvider` takes one). `type="application/ld+json"` blocks are data, not scripts, and need none.
- **Dev ships NO nonce on purpose** — the dev server's HMR/error-overlay inline scripts aren't all nonced, and dev CSP isn't a security boundary. Verify nonce work against a **production build** (`.claude/launch.json` → `web-prod`); `next dev` cannot exercise it.
- **`style-src` stays nonce-free** with `'unsafe-inline'`: next/font and React inject unnonced inline styles, and noncing styles would disable them under the same CSP3 rule.
- Next reads the nonce out of the **request** `content-security-policy` header (`app-render.js` → `getScriptNonceFromHeader`) to stamp its own hydration/RSC scripts. Setting CSP only on the _response_ is why the earlier attempt (#411101a8, reverted in #fdadba28 with the wrong conclusion "can't be nonced together with next-intl") silently never worked. `proxy.ts` must keep forwarding `content-security-policy` + `x-nonce` as request headers.

## Vault

**Server-side encryption at rest — NOT end-to-end.** AES-256-GCM, fresh random
IV per record, auth tag appended. The per-user key is `scrypt(masterKey, userId)`
and the master key is `VAULT_ENCRYPTION_KEY` from the server's env (production
fails fast without it). The server therefore _can_ decrypt everything, by
necessity — it is what serves the plaintext back to the owner.

Call it what it is. "End-to-end" means the server cannot decrypt. Two
user-facing strings claimed it — `vault.subtitle` and
`helpCenter.faqItems.dataPrivacy.answer` — and a third, unrendered
`vault.security.zeroKnowledge` ("零知识架构"), claimed something stronger still:
zero-knowledge means the operator _has no ability_ to read the data, which is
the exact opposite of a server-held master key. All three are gone; the copy now
says AES-256 encryption at rest, which is what this is. The unused key was
deleted rather than reworded — an untrue claim sitting in a locale file is a
landmine for whoever builds the security badge it was written for.

This is a privacy claim users act on when deciding what to put in the vault.
Never restore an end-to-end or zero-knowledge claim without a design where the
key never reaches the server.

- `deriveUserKey` is cached per user. scryptSync is synchronous and blocks the
  whole event loop for ~22ms; `exportAll` decrypts every item of one user, so
  deriving per item made a 100-item vault a ~2.2s process-wide stall.

## Account deletion

`DELETE /users/me` is a **soft delete**. It disables login, anonymises the
email, clears the profile identifiers (realName / nickname / avatarUrl / bio /
birthday), redacts sent messages, sets the user's admission cases to PRIVATE,
and deletes follows and blocks. **The rows stay.**

### The purge

`AccountPurgeService` (`modules/user/account-purge.service.ts`) is the job that
makes the deletion real. Daily at 04:00, single-flight via `runWithCronLock`
(hard deletion is irreversible and NOT idempotent across replicas — this is one
of the jobs that genuinely needs the lock), it calls `UserService.hardDelete`
for every account whose grace window has closed.

Both flags are now **stated explicitly** in the production deploy
(`.github/workflows/ci.yml`, the `--set-env-vars` line of "Deploy canary"),
not left to their defaults. Same values, so nothing changed — but whether the
one irreversible job runs, and the number a user-facing promise has to match,
should be readable in the deploy config rather than inferred from a schema.
Note that `--set-env-vars` replaces the whole set: dropping them from that line
silently returns both to their defaults.

- **`ACCOUNT_PURGE_ENABLED` is `false`** (also the default). Not a placeholder:
  the first enabled run purges the entire existing backlog of soft-deleted
  accounts at once, irreversibly. While disabled the job still runs and logs
  what it _would_ remove, so the blast radius is a log line rather than a guess:

  ```
  gcloud logging read 'resource.type=cloud_run_revision AND
    resource.labels.service_name=study-abroad-api AND
    textPayload=~"Account purge DRY RUN"' \
    --project=study-abroad-prod-2025 --limit=7
  ```

  **Read that before enabling.** One `hardDelete` cascades 55 relations off
  `User` — profile, vault items, cases, resumes, forum posts, messages, points,
  team memberships — and there is no undo.

- **`ACCOUNT_PURGE_GRACE_DAYS` is 30** (also the default) — what the old copy
  promised.
- **Capped at 200 accounts per run**; the remainder is picked up the next day.
- **Accounts holding `Payment` rows are skipped and logged, never purged.**
  `Payment` cascades off `User`, so purging the account destroys the financial
  record with it, and retention obligations outrank erasure ones. Payments are
  retired (production refuses to boot with `PAYMENTS_ENABLED != false`), so this
  should only ever match historical rows — but if it starts matching, that is a
  retention policy decision, not a bug to code around.
- A single failing account is logged and skipped, not allowed to strand the batch.

**Copy may only promise what the flag currently does.** The three strings that
used to claim 数据将被永久删除 — `settings.items.deleteAccountDesc`,
`settings.dialogs.deleteDesc`, `security.dangerZoneDesc` (plus the mobile
`settings.deleteAccountConfirm`, `security.deleteAccountWarning`,
`security.deleteAccountConfirmMessage`) — describe what the user actually
experiences today: sign-in disabled, identifiers cleared, messages redacted,
cases turned private. **Restore a retention period in that copy only when
`ACCOUNT_PURGE_ENABLED=true` in production**, and state the same number as
`ACCOUNT_PURGE_GRACE_DAYS`. A promise ahead of the flag is the exact defect this
service was built to close.

`AuditLog` deliberately survives a purge: `AuditLog.userId` is a bare column
with no relation, so it does not cascade. That is correct — an audit trail that
disappears with its subject is not an audit trail.

## Dependency CVEs

- CI hard-fails on **high** via `pnpm audit --audit-level=high`; `pnpm lint:audit-gate` (in `lint:all`) keeps that gate from being softened (no `|| true` / `continue-on-error` / relaxed level).
- Fix high/critical by upgrading or pinning via root `pnpm.overrides` (narrowest range). Full process: `docs/SECURITY_DEPS.md`.
