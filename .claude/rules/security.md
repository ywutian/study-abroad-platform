---
description: "Security patterns and authentication rules"
globs: ["**/auth/**", "**/guards/**", "**/vault/**", "**/common/guards/**", "**/common/interceptors/**"]
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

- **`'unsafe-eval'` is dev-only — production must NEVER include it** (prod uses the narrower `'wasm-unsafe-eval'`). Pinned by `lib/security/csp.test.ts`.
- `'unsafe-inline'` IS allowed in prod `script-src`/`style-src`: Next.js App Router emits inline hydration/RSC scripts that can't be nonced together with next-intl middleware (decided in #fdadba28). CSP logic lives in `lib/security/csp.ts`.

## Vault

- End-to-end encryption (AES-256 with IV)
- Encryption key derived from userId

## Dependency CVEs

- CI hard-fails on **high** via `pnpm audit --audit-level=high`; `pnpm lint:audit-gate` (in `lint:all`) keeps that gate from being softened (no `|| true` / `continue-on-error` / relaxed level).
- Fix high/critical by upgrading or pinning via root `pnpm.overrides` (narrowest range). Full process: `docs/SECURITY_DEPS.md`.
