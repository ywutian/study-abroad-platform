---
description: "Backend development rules for NestJS API"
globs: ["apps/api/**"]
---

# Backend Rules

## Request Lifecycle

Pipeline order (defined in `app.module.ts`): Middleware (CorrelationId -> Timeout) -> Guards (Throttler -> JwtAuth -> Roles -> Permission -> FeatureFlag) -> Interceptors (Sanitize -> Sentry -> Transform -> Logging) -> AllExceptionsFilter.

## Auth Decorators

- `@Public()` — skip JWT auth (login, register, health, verify-email)
- `@Roles(Role.ADMIN)` — require specific role
- `@CurrentUser()` — extract `{ id, email, role, locale }` from request

## Rate Limiting

- LLM endpoints **MUST** use `@ThrottleAI()` (20 req/min) from `common/decorators/throttle.decorator`
- Sensitive ops (auth, vault): `@ThrottleSensitive()` (5/min) or `@ThrottleStrict()` (3/min)
- Read-heavy: `@ThrottleRelaxed()` (200/min)
- Health: `@SkipThrottle()`

## DTO Validation

- **Never** inline `@Body() body: { ... }` — always create DTO class with `class-validator`
- All string fields **MUST** have `@MaxLength()`: titles 200, body 50000, short inputs 500
- Array fields: `@IsArray()` + `@IsString({ each: true })`
- DTOs in `dto/` subdirectory, exported via `dto/index.ts` barrel

## Exception Handling

- Throw NestJS exceptions (`BadRequestException`, `NotFoundException`) — **never** `throw new Error()`
- Exception: startup validators may `throw new Error()` to crash the process

## Prisma Select & Response Mapping

```typescript
// ALWAYS use shared constants:
import { SCHOOL_BASIC_SELECT } from '../../common/constants/prisma-selects';
// ALWAYS use mapper functions:
school: mapSchoolForList(item.school),  // NOT inline { id: item.school.id }
// NEVER duplicate select blocks — extract to *.constants.ts:
export const MY_SELECT = { ... } as const satisfies Prisma.ModelSelect;
export type MyResult = Prisma.ModelGetPayload<{ select: typeof MY_SELECT }>;
export function mapMyResult(item: MyResult) { return { ... }; }
```

Shared constants in `common/constants/prisma-selects.ts`: `SCHOOL_BASIC_SELECT`, `SCHOOL_NAME_SELECT`, `SCHOOL_NAME_RANK_SELECT`, `USER_SUMMARY_SELECT`.

## Health Endpoints

- `/health`, `/health/live`, `/health/ready`, `/health/startup` — `@Public()` (probes)
- `/health/detailed` — `@Roles(Role.ADMIN)` (exposes env/build info)

## OpenTelemetry

- `apps/api/src/tracing.ts` — OTel SDK init, first import in `main.ts`
- Conditionally enabled via `OTEL_EXPORTER_OTLP_ENDPOINT`. Zero overhead when disabled.
- Auto-instruments: HTTP, Express, ioredis, Prisma queries

## Feature Flags

Database-backed with Redis caching (60s TTL). Usage:
```typescript
@FeatureFlag('prediction-v4')  // Endpoint-level
await this.featureFlagService.isEnabled('new-algo', { userId, role });  // Service-level
```
Key files: `common/feature-flags/` (@Global()), `admin/admin-feature-flag.controller.ts`
Rules JSON: `{ "roles": ["ADMIN"], "userIds": ["uuid"], "percentage": 50 }`. Evaluation: roles -> userIds -> percentage (any match = enabled).

## Code Review Checklist (Backend)

1. [AUTO] `@Body()` uses DTO class, not inline type
2. [AUTO] String DTO fields have `@MaxLength()`
3. [AUTO] AI routes have `@ThrottleAI()`
4. [AUTO] No `throw new Error()` in services
5. [AUTO] Service has `.spec.ts` test file
6. [AUTO] API routes use shared constants (`packages/shared/src/constants/api-routes.ts`)
7. [MANUAL] Sensitive endpoints have `@Roles(Role.ADMIN)`
8. [MANUAL] DTO fields have `@ApiProperty()` for Swagger

## API Quality Checks (`check-api-quality.ts`)

| Rule | Severity | Catches |
|------|----------|---------|
| `no-inline-body` | error | `@Body() body: { ... }` inline types |
| `no-unthrottled-ai` | warning | AI route without `@Throttle*` |
| `no-generic-throw` | warning | `throw new Error()` in services |
| `no-missing-maxlength` | warning | `@IsString()` without `@MaxLength()` |
| `no-missing-test` | error (staged) / warning (full-scan) | NEW service without `.spec.ts` blocks at pre-commit; existing backlog stays a full-scan warning |
| `no-duplicated-select` | warning | Same select block repeated 2+ times |
| `no-select-mapping-drift` | warning | SELECT field not in mapper |
| `no-raw-redis-getclient` | error | `redis.getClient()` bypassing metrics/circuit-breaker — use a wrapper or `redis.withClient()` (suppress `// @redis-raw-allowed`) |
| `no-hardcoded-redis-ttl` | error | Numeric TTL literal on a Redis write — use `REDIS_TTL.*` from `common/redis/redis-ttl.constants` (suppress `// @redis-ttl-allowed`) |
| `no-redis-poll-without-backoff` | error | `setInterval` polling Redis on a fixed <30s cadence (the #274 quota-burn) — use setTimeout-reschedule + backoff (suppress `// @redis-poll-allowed`) |
| `no-magic-arraysize` | error (staged) / warning (full-scan) | Numeric `@ArrayMaxSize(N)` literal on a user-facing DTO array — use a shared cap constant (`packages/shared`) so FE+BE caps can't drift (the #396–398 silent-400 class). Suppress a deliberate fixed-set cap with `// @arraysize-literal-allowed` |
| `no-uncapped-array` | error (staged) / warning (full-scan) | User-facing DTO array field (`@IsArray`) with NO `@ArrayMaxSize` → a user can POST an unbounded array (DoS / payload bloat). Add `@ArrayMaxSize(<shared const>)` (the #399 close). Skips `/modules/admin/`, `batch`/`bulk` filenames, `/distillation/`; suppress with `// @arraysize-uncapped-allowed` |

## Deep Dive

- Architecture overview: `docs/ARCHITECTURE.md`
- Engineering standards: `docs/ENGINEERING_STANDARDS.md`
