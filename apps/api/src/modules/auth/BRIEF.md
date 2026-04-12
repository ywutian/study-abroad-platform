# Module: auth

## Purpose

Authentication and session management: JWT access/refresh tokens, registration, login, email verification, password reset, brute-force protection, MCP API keys.

## Key Files

- `auth.controller.ts` — Register, login, refresh, logout, verify-email, forgot/reset password, change password
- `auth.service.ts` — Core auth logic: bcrypt hashing, JWT generation, token rotation, email verification
- `session-manager.service.ts` — Multi-device session tracking and revocation
- `brute-force.service.ts` — Redis-based login attempt limiting (Lua script for atomic INCR+EXPIRE)
- `mcp-api-key.controller.ts` / `mcp-api-key.service.ts` — Machine-to-machine API key management

## Data Model

User (email, passwordHash, role, emailVerified), RefreshToken (token, userId, expiresAt), Session, McpApiKey. References: referral codes via User.referredById.

## Dependencies

JwtService, ConfigService, PrismaService, UserService, EmailService, SessionManager, BruteForceService, EventEmitter2, AuditLogService | AI/LLM: No

## Business Rules

- Refresh token stored in httpOnly cookie (7 day TTL), access token 15 min
- Refresh rotation uses `$transaction` to prevent race conditions
- Login always runs `bcrypt.compare` even for non-existent users (constant-time, anti-enumeration)
- `@ThrottleSensitive()` / `@ThrottleStrict()` on auth endpoints
- Registration emits `USER_REGISTERED` event (triggers welcome notification + points)
- All auth endpoints are `@Public()` (no JWT required)

## Gotchas

- Access token also set as httpOnly cookie for Next.js middleware route protection
- Cookie sameSite is `strict` in production, `lax` in development
- Ban check happens in `JwtStrategy.validate()` so WebSocket auth also rejects banned users
- Referral code validation happens during registration
