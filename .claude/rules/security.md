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

- `unsafe-inline`/`unsafe-eval` only in development; production must not include them

## Vault

- End-to-end encryption (AES-256 with IV)
- Encryption key derived from userId
