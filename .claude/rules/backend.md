---
description: 'Backend development rules for NestJS API'
globs: ['apps/api/**']
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

### `include` does not restrict scalars — three live leaks came from this

`findMany({ where, include: { school: … } })` returns **every scalar column of
the model**, not just the relation you asked for. Only a top-level `select`
narrows scalars. So a `@Public()` route querying with `include` ships `userId`,
and `AdmissionCase.userId` is the same value `GET /forum/posts` publishes as
`author.id` beside `profile.realName` — both unauthenticated. Pull the public
list, match the id against the forum feed, read the name.

Fixed in feaa8cce (case list/detail), afb38270 (hall verified leaderboard) and
21d666d1 (team guest deck). The last two had already been hardened _against
this exact concern_ — hall's mapper carries "Plan C security B4: masked label,
never realName", team's serializer degrades displayName to `Member N` and gates
school/grade on consent — and both then emitted the id that undoes the masking.
Masking the name is not the job; removing the join key is.

Rules for a response that leaves an unauthenticated route:

- Never return `userId` / `authorId` / `verifiedBy` unless the viewer owns the
  row or is privileged. Strip in the mapper (the query often still needs the
  column for its own ownership check).
- A derived pseudonym must not be derived from the id either. `用户${userId.slice(-4)}`
  was 4 chars of a cuid, which narrows a few-thousand-author forum to one
  person. Derive it from the row's own id instead.
- Assert it in the spec: `expect(row).not.toHaveProperty('userId')` plus
  `expect(JSON.stringify(row)).not.toContain(theId)` — the second is what
  catches a pseudonym built out of the id.
- **Strip the relation, not just the scalar.** `anonymizeProfile` deleted the
  `userId` column and shipped `user: { id }` anyway, because the query's
  `include` carried the relation and the destructure only named the scalar. The
  spec passed because its fixture had no `user` key. A fixture made of scalars
  cannot show a relation surviving — give it the relation.

### Review status is not access control

`CASE_REVIEW_APPROVED_WHERE` says a human approved the data. It says nothing
about who may read it, and `AdmissionCase.visibility` defaults to `PRIVATE`.
Filtering on review alone therefore serves PRIVATE and VERIFIED_ONLY rows to
anyone holding an id — which is what `explain_case_result` and
`compare_case_with_profile` did, while `GET /cases/:id` answers 403 for both.
The ids were free: the `@Public()` hall leaderboard publishes `caseId` for
VERIFIED_ONLY cases. Use `CASE_PUBLIC_VISIBILITY_WHERE` on any surface that
serves a case without knowing the caller's role.

**`VERIFIED_ONLY` needs a role, so a surface without one cannot serve it.** It
means "visible to `Role.VERIFIED`", enforced that way in `case-query.service`.
`UserContext` carries no role, so the ai-agent tool layer cannot honour it —
`find_similar_applicants` was serving those cases' GPA, scores, activities and
awards to any authenticated caller. Hall may include VERIFIED_ONLY only because
it publishes aggregates, never the row. Three visibility sets across four
modules is how the next one drifts; prefer the shared constant.

### Aggregates over people need a cohort floor

An admit rate over a thin slice is a statement about identifiable people: at a
school+nationality pair with one case, "100% admitted" publishes where that
applicant got in. Counts are far weaker than outcomes — how many applied leaks
much less than how they did — so suppress the outcome breakdown and the rate,
not the count.

**Floor is 5** (`CaseToolsService.MIN_REPORTABLE_COHORT`), matching prediction.
Hall uses 3 and 5 (`MIN_YEAR_TOTAL`, `ED_RD_MIN_SAMPLE`), school uses 10
(`MIN_CASES`). Common practice ranges 3–30; 5 is the usual floor for aggregate
reporting over people.

Two things that are easy to get wrong:

- **Every slice needs its own check.** Flooring only the combined figure lets a
  thin sub-cohort ride out inside a healthy total.
- **The prose must honour it too.** These aggregates are fed to an LLM as a
  summary string; withholding the fields and then restating the rate in the
  summary leaks exactly what was suppressed. Assert that in the spec.

Secondary suppression (blanking a second cell so the first can't be recovered by
subtraction) is not needed while the slices are not complements — revisit if a
surface ever reports a total alongside all its parts.

### A precondition read before the write is not a check

Read balance → compare → `update` is two statements, so under READ COMMITTED
(the default; this repo sets no isolation level) two callers read the same
pre-spend value, both pass, and both write. `increment` being atomic does not
help — it makes the _write_ safe, not the _decision_. Sharing a `$transaction`
does not help either; that buys atomicity with the neighbouring write, nothing
more. Put the precondition in the WHERE and throw on `count === 0`:

```typescript
const claimed = await db.user.updateMany({
  where: { id: userId, points: { gte: cost } }, // the check IS the write
  data: { points: { decrement: cost } },
});
if (claimed.count === 0) throw new BadRequestException('积分不足');
```

Assert the WHERE in the spec, not just the outcome — a test that only checks
"insufficient balance is rejected" still passes once the guard moves back into
a preceding read.

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

| Rule                            | Severity                             | Catches                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-inline-body`                | error                                | `@Body() body: { ... }` inline types                                                                                                                                                                                                                                                                                                                                                                     |
| `no-unthrottled-ai`             | warning                              | AI route without `@Throttle*`                                                                                                                                                                                                                                                                                                                                                                            |
| `no-generic-throw`              | warning                              | `throw new Error()` in services                                                                                                                                                                                                                                                                                                                                                                          |
| `no-missing-maxlength`          | warning                              | `@IsString()` without `@MaxLength()`                                                                                                                                                                                                                                                                                                                                                                     |
| `no-missing-test`               | error (staged) / warning (full-scan) | NEW service without `.spec.ts` blocks at pre-commit; existing backlog stays a full-scan warning                                                                                                                                                                                                                                                                                                          |
| `no-duplicated-select`          | warning                              | Same select block repeated 2+ times                                                                                                                                                                                                                                                                                                                                                                      |
| `no-select-mapping-drift`       | warning                              | SELECT field not in mapper                                                                                                                                                                                                                                                                                                                                                                               |
| `no-raw-redis-getclient`        | error                                | `redis.getClient()` bypassing metrics/circuit-breaker — use a wrapper or `redis.withClient()` (suppress `// @redis-raw-allowed`)                                                                                                                                                                                                                                                                         |
| `no-hardcoded-redis-ttl`        | error                                | Numeric TTL literal on a Redis write — use `REDIS_TTL.*` from `common/redis/redis-ttl.constants` (suppress `// @redis-ttl-allowed`)                                                                                                                                                                                                                                                                      |
| `no-redis-poll-without-backoff` | error                                | `setInterval` polling Redis on a fixed <30s cadence (the #274 quota-burn) — use setTimeout-reschedule + backoff (suppress `// @redis-poll-allowed`)                                                                                                                                                                                                                                                      |
| `no-magic-arraysize`            | error (staged) / warning (full-scan) | Numeric `@ArrayMaxSize(N)` literal on a user-facing DTO array — use a shared cap constant (`packages/shared`) so FE+BE caps can't drift (the #396–398 silent-400 class). Suppress a deliberate fixed-set cap with `// @arraysize-literal-allowed`                                                                                                                                                        |
| `no-uncapped-array`             | error (staged) / warning (full-scan) | User-facing DTO array field (`@IsArray`) with NO `@ArrayMaxSize` → a user can POST an unbounded array (DoS / payload bloat). Add `@ArrayMaxSize(<shared const>)` (the #399 close). Skips `/modules/admin/`, `batch`/`bulk` filenames, `/distillation/`; suppress with `// @arraysize-uncapped-allowed`                                                                                                   |
| `no-unasserted-cache-parse`     | error                                | `return JSON.parse(...)` with no assertion in a Redis-touching file. JSON.parse is `any`, so it silently satisfies the declared return type — which is how a cached Prisma model kept promising `Date` while handing back ISO strings (the f0e5511b profile-import crash). Assert the parsed shape or rehydrate it; suppress with `// @cache-parse-allowed` **and say why the type has no Date to lose** |

## Deep Dive

- Architecture overview: `docs/ARCHITECTURE.md`
- Engineering standards: `docs/ENGINEERING_STANDARDS.md`
