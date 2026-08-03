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

Call it what it is. "End-to-end" means the server cannot decrypt, and two
user-facing strings currently claim it — `vault.subtitle` and
`helpCenter.faqItems.dataPrivacy.answer` in `apps/web/src/messages/{zh,en}.json`.
That is a privacy claim users may rely on when deciding what to store; either
the copy changes or the design does, and neither is a change to make silently.

- `deriveUserKey` is cached per user. scryptSync is synchronous and blocks the
  whole event loop for ~22ms; `exportAll` decrypts every item of one user, so
  deriving per item made a 100-item vault a ~2.2s process-wide stall.

## Account deletion

`DELETE /users/me` is a **soft delete**. It disables login, anonymises the
email, clears the profile identifiers (realName / nickname / avatarUrl / bio /
birthday), redacts sent messages, sets the user's admission cases to PRIVATE,
and deletes follows and blocks. **The rows stay.**

There is no purge. `hardDelete` has no caller anywhere outside its own
definition, and the only `deletedAt`-aware job is token-cleanup, which deletes
refresh tokens. The endpoint used to answer "Your data will be permanently
removed within 30 days" — a retention commitment with nothing behind it, now
removed.

Do not re-add a retention promise, in the API response or in UI copy, without
the job that honours it. The three strings that used to claim
数据将被永久删除 — `settings.items.deleteAccountDesc`,
`settings.dialogs.deleteDesc` and `security.dangerZoneDesc` — now describe what
the user actually experiences: sign-in disabled, identifiers cleared, messages
redacted, cases turned private. They deliberately do NOT state that rows are
retained; that belongs in the privacy policy, not a confirm dialog. What they
must never do again is claim a deletion the system does not perform.

## Dependency CVEs

- CI hard-fails on **high** via `pnpm audit --audit-level=high`; `pnpm lint:audit-gate` (in `lint:all`) keeps that gate from being softened (no `|| true` / `continue-on-error` / relaxed level).
- Fix high/critical by upgrading or pinning via root `pnpm.overrides` (narrowest range). Full process: `docs/SECURITY_DEPS.md`.
