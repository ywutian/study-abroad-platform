# Study Abroad Platform — Development Guide

## Architecture Overview

Turbo monorepo with pnpm workspaces:

- `apps/api` — NestJS 11 backend (PostgreSQL + Prisma, Redis)
- `apps/web` — Next.js 16 frontend (React 19, Tailwind, next-intl)
- `apps/mobile` — Expo 54 (React Native)
- `packages/shared` — Shared types, constants, scoring algorithms

## Backend Module Map

28 domain modules in `apps/api/src/modules/` (see `app.module.ts`):

**Core Business:**

- `auth` — JWT auth, refresh token rotation, brute force protection, email verification
- `user` — User CRUD, dashboard, soft delete
- `profile` — Student profiles (test scores, activities, awards, education)
- `school` — School database (3000+ institutions), scraping, data sync
- `school-list` — User school lists with application tracking
- `prediction` — Admission probability (v3-enterprise, multi-engine ensemble + Platt calibration)
- `case` — Admission case gallery, incentive system, verification
- `ranking` — Custom school rankings, weighted scoring

**Content & Social:**

- `chat` — Real-time messaging (WebSocket gateway at `/chat` namespace)
- `forum` — Discussion forums, categories, moderation
- `hall` — Hall of Fame (admitted student profiles, trending)
- `swipe` — Admission case swiping / review game
- `peer-review` — Peer essay review system with ratings

**Essay & AI:**

- `ai` — Simple AI service facade (chat, analyzeProfile, reviewEssay)
- `ai-agent` — Enterprise multi-agent system (see `memory/ai-system.md`)
- `essay-ai` — Essay review, polish, brainstorm
- `essay-prompt` — Essay prompt database & scraping
- `essay-scraper` — Essay prompt scraping pipeline
- `recommendation` — AI school recommendations
- `assessment` — MBTI/Holland/Strength assessments

**Platform:**

- `timeline` — Deadlines, personal events, global events
- `notification` — Push notifications, email digests, broadcast
- `subscription` — Payment plans, invoicing
- `vault` — Encrypted document storage (AES-256)
- `verification` — Identity & admission verification
- `settings` — System settings
- `admin` — Admin panel API (stats, user mgmt, reports, CRUD)
- `health` — Health check (`/health`)

**Infrastructure** (`apps/api/src/common/`):
`prisma/` (global DB), `redis/` (global cache), `logger/` (global structured logging), `email/` (SMTP), `storage/` (S3/OSS/COS), `sentry/` (error tracking), `services/authorization` (global RBAC), `services/audit-log` (global audit)

## Request Lifecycle

Every HTTP request passes through this pipeline (defined in `app.module.ts`):

**Middleware** (applied to all routes):

1. `CorrelationIdMiddleware` — assigns `X-Correlation-ID` (UUID) for tracing
2. `TimeoutMiddleware` — enforces `REQUEST_TIMEOUT_MS` (30s default, 120s AI routes)

**Guards** (registration order): 3. `ThrottlerGuard` — rate limiting (default: 100 req / 60s per IP) 4. `JwtAuthGuard` — JWT Bearer token validation; skip with `@Public()` decorator 5. `RolesGuard` — role check via `@Roles(Role.ADMIN)` decorator

**Interceptors** (registration order): 6. `SanitizeInterceptor` — strips HTML from request body (XSS prevention) 7. `SentryInterceptor` — captures exceptions to Sentry 8. `TransformInterceptor` — wraps response in `{ success, data, meta }` envelope 9. `LoggingInterceptor` — logs request/response with timing, masks PII

**Exception Filter:** 10. `AllExceptionsFilter` — catches all errors → standardized `{ success: false, error }` JSON

## Authentication & Authorization

### JWT Token Flow

- **Access token**: JWT signed with `JWT_SECRET`, 15m expiry, payload: `{ sub, email, role }`
- **Refresh token**: Random 64-byte hex, stored in `RefreshToken` table, 7d expiry
- **Token rotation**: Each refresh invalidates old token, issues new pair
- **Brute force**: `BruteForceService` locks account after repeated login failures (Redis-backed)
- Password hashing: bcrypt with 12 rounds

### Role Hierarchy

| Role       | Access                   | Notes                                                 |
| ---------- | ------------------------ | ----------------------------------------------------- |
| `USER`     | Basic features           | Default on registration                               |
| `VERIFIED` | USER + verified features | After email verification + admin approval             |
| `ADMIN`    | Everything               | `RolesGuard` grants full access, overrides all checks |

### Decorators

- `@Public()` — skip JWT auth (used on login, register, health, verify-email)
- `@Roles(Role.ADMIN)` — require specific role
- `@CurrentUser()` — extract user from request: `{ id, email, role, locale }`

### Frontend Auth Pattern

- Access token stored **in-memory only** (Zustand store — never localStorage)
- Refresh token in **httpOnly cookie** (set by API, inaccessible to JS)
- `AuthInitializer` component calls `/auth/refresh` on app mount to restore session
- `apiClient` auto-retries on 401 with token refresh, then redirects to login on failure

## Response Format

**Success** (`TransformInterceptor`):

```json
{ "success": true, "data": { ... }, "meta": { "timestamp": "ISO8601", "correlationId": "uuid", "responseTimeMs": 42 } }
```

**Error** (`AllExceptionsFilter`):

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "...",
    "timestamp": "ISO8601",
    "path": "/api/v1/...",
    "correlationId": "uuid"
  }
}
```

Error codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DUPLICATE_ENTRY`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `DATABASE_UNAVAILABLE`, `QUERY_TIMEOUT`.

Prisma error mapping: P2002 → `DUPLICATE_ENTRY` (409), P2025 → `NOT_FOUND` (404), P2003 → `FOREIGN_KEY_ERROR` (400), P1001/P1002 → `DATABASE_UNAVAILABLE` (503), P2024 → `QUERY_TIMEOUT` (504).

**Frontend note**: `apiClient` unwraps `response.data` automatically — component code receives the inner `data` object directly.

## AI System Architecture

> Full details: see `memory/ai-system.md` for module map, LLM call chains, tool system, memory system, and admin endpoints.

### LLM Provider Abstraction

All LLM calls go through `ILLMProvider` interface (`ai-agent/providers/`). Provider selected by `LLM_PROVIDER` env var (default: `openai`). `LLMProvidersModule.forRoot()` is `global: true`.

### Two Entry Points

| Service                         | When to use                                                  | Features                                           |
| ------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| `AiService` (`ai/`)             | Simple one-shot calls (essay-ai, recommendation, prediction) | Direct provider call, no resilience                |
| `LLMService` (`ai-agent/core/`) | Agent loop calls (orchestrator, agent runner)                | Retry + circuit breaker + timeout + token tracking |

### Tool System

11 domain tool services implementing `IToolHandlerProvider`. See `memory/ai-system.md` for full list and how to add new tools.

### Memory System

Enterprise memory: Redis (hot) + PostgreSQL (cold) + pgvector (semantic search). See `memory/ai-system.md` for architecture.

### Security

`@Global() AgentSecurityModule`: PromptGuardService (injection detection), ContentModerationService (harmful content), AuditService (security event logging).

## Mandatory Patterns

### JSON Extraction from LLM Responses

```typescript
// ALWAYS use:
import { extractJsonFromLlm } from '../ai-agent/tools/helpers/llm-json.helper';
const parsed = extractJsonFromLlm<MyType>(llmResponse);
// NEVER use: result.match(/\{[\s\S]*\}/)
```

### Types

All shared AI types in `packages/shared/src/types/index.ts`: `AgentType`, `StreamEvent`, `ActionButton`, `Message`, `ToolCall`, `PredictionResult`, `RecommendationResult`, `AIAnalysisResult`. Frontend-only UI types stay local to components.

### Frontend AI Requests

```typescript
import { AI_TIMEOUTS } from '@/lib/constants';
const mutation = useMutation({
  mutationFn: (dto) => apiClient.post('/endpoint', dto, { timeout: AI_TIMEOUTS.AI_REQUEST }),
  // Error handling: global MutationCache in query-provider.tsx handles toast
});
```

### Prisma Select & Response Mapping

```typescript
// ALWAYS use shared constants for Prisma select blocks:
import { SCHOOL_BASIC_SELECT, SCHOOL_NAME_SELECT } from '../../common/constants/prisma-selects';
// Module-level extensions:
import { SCHOOL_LIST_SCHOOL_SELECT, mapSchoolForList } from './school-list.constants';

// ALWAYS use mapper functions for response construction:
school: mapSchoolForList(item.school),  // NOT inline { id: item.school.id, ... }

// NEVER duplicate inline select blocks — extract to *.constants.ts with:
export const MY_SELECT = { ... } as const satisfies Prisma.ModelSelect;
export type MyResult = Prisma.ModelGetPayload<{ select: typeof MY_SELECT }>;
export function mapMyResult(item: MyResult) { return { ... }; }
```

Shared constants in `common/constants/prisma-selects.ts`: `SCHOOL_BASIC_SELECT`, `SCHOOL_NAME_SELECT`, `SCHOOL_NAME_RANK_SELECT`, `USER_SUMMARY_SELECT`. Module constants in `module-name.constants.ts`.

### Error Handling

- Backend: Throw `BadRequestException` for user errors; let `LLMProviderError` propagate for provider issues
- Frontend: Global `MutationCache.onError` handles toast; use `meta.skipGlobalErrorToast` to opt out
- AI Error Boundary: `<AIErrorBoundary feature="...">` wraps AI feature components

## Backend Security Patterns

### Rate Limiting Rules

- All endpoints calling LLM APIs **MUST** use `@ThrottleAI()` (20 req/min) from `common/decorators/throttle.decorator`
- Sensitive operations (auth, vault) use `@ThrottleSensitive()` (5/min) or `@ThrottleStrict()` (3/min)
- Read-heavy endpoints can use `@ThrottleRelaxed()` (200/min)
- Health endpoints use `@SkipThrottle()`

### DTO Validation Rules

- **Never** use inline `@Body() body: { ... }` types — always create a DTO class with `class-validator` decorators
- All string fields **MUST** have `@MaxLength()`: titles → 200, body content → 50000, short inputs → 500
- Array fields use `@IsArray()` + `@IsString({ each: true })`
- DTOs live in `dto/` subdirectory of each module, exported via `dto/index.ts` barrel

### Health Endpoint Access

- `/health`, `/health/live`, `/health/ready`, `/health/startup` — `@Public()` (probes)
- `/health/detailed` — `@Roles(Role.ADMIN)` (exposes env/build info)

### Exception Handling

- Service methods: throw NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.) — **never** `throw new Error()`
- Exception: startup validators (`config-validator.service.ts`, `encryption.service.ts`) may use `throw new Error()` to crash the process

## Module Dependency Rules

```
ai-agent/security/  →  @Global(), no imports needed
ai-agent/providers/ →  global: true via forRoot(), no imports needed
ai-agent/memory/    →  Import AiAgentMemoryModule for MemoryManagerService
ai-agent/           →  Import AiAgentModule for OrchestratorService, TokenTrackerService
ai/                 →  Import AiModule for AiService
```

- `AiModule` does NOT import `AiAgentModule` (no circular deps)
- External domain modules (Prediction, Assessment, Forum, Swipe, Hall) are imported by `AiAgentModule` for tool service DI
- Never import a service directly from another module's internal files without importing the module

## Database

- **Schema**: `apps/api/prisma/schema.prisma` (2046 lines, 28 enums, 50+ models)
- **Key enums**: `Role` (USER/VERIFIED/ADMIN), `Visibility` (PRIVATE/PUBLIC/ANONYMOUS/VERIFIED_ONLY), `AdmissionResult`, `ApplicationStatus`, `TestType`, `MemoryType`
- **Extensions**: pgvector (1536-dim embeddings for AI memory semantic search)
- **Commands**:
  - Generate client: `pnpm --filter api db:generate`
  - Push schema (dev, no migration file): `pnpm --filter api db:push`
  - Create migration: `pnpm --filter api db:migrate`
  - Seed data: `pnpm --filter api db:seed`
  - Browse data: `pnpm --filter api db:studio` (http://localhost:5555)
- **Seeds**: `seed.ts` (main), `seed-aliases.ts`, `seed-competitions.ts`, `seed-essay-prompts-v2.ts`, `seed-forum-categories.ts`
- **Schema Change Rules**:
  - Every `schema.prisma` change **MUST** create a migration file: `pnpm --filter api db:migrate -- --name <descriptive_name>`
  - **Never** use `db:push` in production or staging — it doesn't create migration history
  - `db:push` is only for local development rapid iteration; switch to `db:migrate` before committing
  - Migration files are auto-deployed via Cloud Run Job (`migrate.sh` → `prisma migrate deploy`)
  - All new columns must be **nullable** or have a **default** to avoid downtime (metadata-only ALTER on PostgreSQL)
  - If promoting fields from `metadata` JSON to schema columns, create a data backfill script in `apps/api/scripts/` with `--apply` flag pattern
  - CI/CD handles migration execution automatically — deploy-gcp.yml runs `prisma migrate deploy` before service update, with auto-rollback on failure

## Environment Variables

Full Zod validation in `common/config/env.validation.ts`. Key variables:

| Category       | Variable                                           | Required | Default                     | Notes                                               |
| -------------- | -------------------------------------------------- | -------- | --------------------------- | --------------------------------------------------- |
| **Core**       | `PORT`                                             | No       | `4101`                      | API server port                                     |
|                | `NODE_ENV`                                         | No       | `development`               | development / production / staging / test           |
| **Database**   | `DATABASE_URL`                                     | Yes      | —                           | PostgreSQL connection (`postgresql://...`)          |
| **JWT**        | `JWT_SECRET`                                       | Yes      | —                           | Min 16 chars, access token signing                  |
|                | `JWT_REFRESH_SECRET`                               | Yes      | —                           | Min 16 chars, refresh token signing                 |
|                | `JWT_EXPIRES_IN`                                   | No       | `15m`                       | Access token lifetime                               |
|                | `JWT_REFRESH_EXPIRES_IN`                           | No       | `7d`                        | Refresh token lifetime                              |
| **Redis**      | `REDIS_URL`                                        | No       | —                           | Falls back to in-memory if unset                    |
| **CORS**       | `CORS_ORIGINS`                                     | Prod     | —                           | Comma-separated origins. **Required in production** |
| **Email**      | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No       | —                           | For verification/welcome/reset emails               |
|                | `FRONTEND_URL`                                     | Prod     | —                           | Used in email links. **Required in production**     |
| **AI**         | `OPENAI_API_KEY`                                   | No       | —                           | OpenAI/DeepSeek API key                             |
|                | `OPENAI_BASE_URL`                                  | No       | `https://api.openai.com/v1` | Compatible endpoint                                 |
|                | `OPENAI_MODEL`                                     | No       | `gpt-4o-mini`               | Default chat model                                  |
|                | `LLM_PROVIDER`                                     | No       | `openai`                    | Provider selection                                  |
| **Storage**    | `STORAGE_TYPE`                                     | No       | `local`                     | `local` / `s3` / `oss` / `cos`                      |
| **Security**   | `VAULT_ENCRYPTION_KEY`                             | Prod     | —                           | Min 32 chars. **Required in production**            |
| **Monitoring** | `SENTRY_DSN`                                       | No       | —                           | Error tracking                                      |
| **Rate Limit** | `THROTTLE_TTL` / `THROTTLE_LIMIT`                  | No       | `60` / `100`                | Per-IP (seconds / count)                            |
| **Timeouts**   | `REQUEST_TIMEOUT_MS`                               | No       | `30000`                     | General request timeout                             |
|                | `AI_REQUEST_TIMEOUT_MS`                            | No       | `120000`                    | AI endpoint timeout                                 |

## Frontend Architecture

### API Proxy

All API calls go through Next.js rewrites: `/api/:path*` → backend. Same-origin avoids CORS cookie issues.

### Provider Chain (`components/providers/index.tsx`)

```
ThemeProvider (next-themes)
  → ErrorBoundary
    → QueryProvider (@tanstack/react-query, staleTime: 5min, retry: 1)
      → ProgressProvider (NProgress page transition bar)
        → TourProvider (onboarding tours via driver.js)
          → AuthInitializer (restore session from httpOnly cookie)
```

Also renders: `<Toaster>` (sonner), `<OfflineIndicator>`, `<FeedbackWidget>`.

### Route Protection (`proxy.ts`)

- Protected: `/profile`, `/dashboard`, `/essays`, `/assessment`, `/prediction`, `/chat`, `/settings`
- Admin: `/admin/*`
- Cookie-based check at Edge (no JWT verification — server-side only)
- Redirects to `/{locale}/login?callbackUrl=...` with open-redirect protection

### i18n

`next-intl` with `{en, zh}` locales. Messages in `apps/web/src/messages/{en,zh}.json`. Use `Link`/`useRouter` from `@/lib/i18n/navigation`.

### CSS Design System (`globals.css`)

OKLCH color system with 50+ CSS custom properties per theme (light/dark). Three subsystems: Core (`--primary`, `--success`, etc.), Auth (`--auth-*`, 30 vars), Hero/Landing (`--hero-*`, `--stat-*`, `--cta-*`).

Key utility classes: `zone-tinted`/`zone-dark` (section backgrounds), `glass`/`glass-heavy`/`glass-premium` (backdrop blur), `text-gradient-*` (5 text gradients), `bg-gradient-*` (6 bg gradients), `text-display-hero`/`text-display-section` (display typography), `section-compact`/`normal`/`expansive` (responsive spacing), 16 `animate-*` classes with 7 delay classes.

### Component Patterns

- **PageHeader + PageContainer**: Use on ALL feature pages. `<PageContainer maxWidth="...">` wraps content, `<PageHeader title icon color stats actions />` provides consistent header. Colors: `blue|violet|amber|emerald|rose|slate|indigo`.
- **Page split**: Pages exceeding ~500 lines should be decomposed: thin `page.tsx` orchestrator + `_components/` directory. Each extracted component is `'use client'` with own state where possible.
- **Motion components**: Use `FadeInView`, `StaggerContainer`, `AnimatedNumber` from `@/components/ui/motion`. All respect `prefers-reduced-motion`.
- **PasswordStrength**: Use from `@/components/ui/password-strength` on password fields. Exports: `PasswordStrength` component, `isPasswordValid()`, `getPasswordScore()`.

### UI Conventions

- **Colors (STRICT — enforced by `check-code-quality.ts`)**:
  - **Prefer CSS vars**: `text-foreground`, `bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-success`, `bg-destructive`.
  - **Hardcoded Tailwind colors** (`bg-emerald-50`, `text-blue-600`): MUST add `dark:` variant (e.g., `bg-emerald-50 dark:bg-emerald-950/30`, `text-blue-600 dark:text-blue-400`).
  - **Never dynamically interpolate Tailwind classes**: `` `bg-${color}-500` `` gets purged in production. Use static class maps instead:
    ```typescript
    // BAD — purged in production build
    className={`bg-${color}-500/10 text-${color}-600`}
    // GOOD — static, scannable by Tailwind
    const COLOR_CLASSES = { blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' }, ... };
    className={`${COLOR_CLASSES[color].bg} ${COLOR_CLASSES[color].text}`}
    ```
  - **Never use `bg-slate-800/900` or `text-white` for page backgrounds** — use `bg-background` and `text-foreground` (auto light/dark).
  - **Intentional dark sections**: Use `.zone-dark` class instead of `bg-slate-900`.
  - **Common mappings**: `bg-slate-50` → `bg-muted`, `text-slate-500/600` → `text-muted-foreground`, `border-slate-200` → `border-border`, `hover:bg-slate-700` → `hover:bg-muted`.
- **Auth pages**: Use `--auth-*` CSS vars (auto light/dark) — never hardcode colors.
- **Typography**: Use utility classes (`text-title`, `text-body-sm`, `text-caption`) from the typography scale, not raw Tailwind `text-xl` etc.
- **Loading**: Use `Skeleton` component from `@/components/ui/skeleton` in `loading.tsx` files, matching page layout structure.

## Development Workflow

### Quick Start

```bash
./dev.sh              # One-command: Docker (PG+Redis) + Prisma + API + Web
./dev.sh --fresh      # Full: migrate + seed + start
```

### Commands

| Command                          | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `pnpm dev`                       | Turbo parallel dev (all apps)           |
| `pnpm api` / `pnpm web`          | Individual app dev                      |
| `pnpm docker:up` / `docker:down` | PostgreSQL 16 (pgvector) + Redis 7      |
| `pnpm build`                     | Production build (all apps via Turbo)   |
| `pnpm lint`                      | ESLint all apps                         |
| `pnpm --filter web lint:quality` | Code quality checks (Tailwind, console) |
| `pnpm test`                      | Unit tests (API: Jest, Web: Vitest)     |
| `pnpm test:e2e`                  | E2E tests (requires running DB + Redis) |
| `pnpm format`                    | Prettier format all files               |

### URLs

- Web: http://localhost:4100 | API: http://localhost:4101 | Swagger: http://localhost:4101/api/docs | Prisma Studio: http://localhost:5555

## CI/CD & Git Conventions

### GitHub Actions

- `ci.yml` (on push/PR): lint (ESLint + i18n + code quality) → typecheck → test → build (parallel jobs)
- `deploy-gcp.yml` (manual): Build → push to Artifact Registry → deploy to Cloud Run → smoke test → auto-rollback on failure
- E2E uses `pgvector/pgvector:pg16` + `redis:7-alpine` service containers

### Commit Convention (commitlint)

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### Pre-commit Hooks (Husky + lint-staged)

1. **Prettier + ESLint** on staged `.ts/.tsx` files (includes import sorting via `simple-import-sort`)
2. **i18n checks** (when `apps/web/src/` changed): missing keys, key consistency, wrong-language detection
3. **Frontend quality checks** (when `apps/web/src/` changed): 7 rules — dynamic Tailwind, hardcoded colors, console.log, page size, loading.tsx, error.tsx
4. **Backend quality checks** (when `apps/api/src/` changed): 5 rules — inline body, throttle, throw, maxlength, tests

### Code Quality Checks (`check-code-quality.ts`)

Custom static analysis (7 rules) that catches issues ESLint can't:

| Rule                        | Severity                     | What it catches                                | Fix                                                                       |
| --------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `no-dynamic-tailwind`       | **error** (blocks commit/CI) | `` `bg-${color}-500` `` — purged in production | Use static class map (`COLOR_CLASSES[color].bg`)                          |
| `no-hardcoded-dark-bg`      | warning                      | `bg-slate-800` without `dark:` variant         | Use CSS vars (`bg-background`) or add `dark:`                             |
| `no-hardcoded-gray`         | warning                      | `bg-gray-100`, `text-gray-600` without `dark:` | Use semantic classes (`bg-muted`, `text-muted-foreground`) or add `dark:` |
| `page-size-limit`           | warning                      | `page.tsx` >500 lines without `_components/`   | Split into thin orchestrator + `_components/`                             |
| `no-console-in-prod`        | warning                      | `console.log/error` in production code         | Use `toast` for user errors, remove debug logs                            |
| `no-missing-loading`        | warning                      | `page.tsx` without sibling `loading.tsx`       | Create Skeleton loading file                                              |
| `no-missing-error-boundary` | warning                      | Route group without `error.tsx`                | Add error.tsx at route group level                                        |

### API Quality Checks (`check-api-quality.ts`)

Backend static analysis (7 rules) integrated into pre-commit and CI:

| Rule                      | Severity                  | What it catches                                         | Fix                                   |
| ------------------------- | ------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `no-inline-body`          | **error** (blocks commit) | `@Body() body: { ... }` inline types                    | Create DTO class with class-validator |
| `no-unthrottled-ai`       | warning                   | AI route without `@Throttle*` decorator                 | Add `@ThrottleAI()`                   |
| `no-generic-throw`        | warning                   | `throw new Error()` in service files                    | Use NestJS exceptions                 |
| `no-missing-maxlength`    | warning                   | `@IsString()` DTO field without `@MaxLength()`          | Add `@MaxLength()` decorator          |
| `no-missing-test`         | warning (full-scan only)  | Service without `.spec.ts` test                         | Create test file                      |
| `no-duplicated-select`    | warning                   | Same Prisma select block repeated 2+ times in service   | Extract to `*.constants.ts`           |
| `no-select-mapping-drift` | warning                   | SELECT constant field not referenced in mapper function | Update mapper to include field        |

### Quick Check Commands

```bash
pnpm lint:all                          # One command: ESLint + quality + i18n
pnpm --filter web lint:quality         # Frontend quality (7 rules)
pnpm --filter api lint:quality         # Backend quality (5 rules)
pnpm --filter web lint:i18n            # i18n checks
```

Exemption lists in each script for known-safe patterns.

## Admin Panel

### Architecture

- 16 pages under `apps/web/src/app/[locale]/(main)/admin/`
- Dashboard uses **recharts** for AreaChart visualizations + health indicator
- Large pages split into `_components/` with self-contained `useQuery` per section
- i18n: `admin.*` keys in `apps/web/src/messages/{en,zh}.json`
- Backend: `AdminController` (`admin/`) + `AgentAdminController` (`admin/ai-agent/`)

### Pages

**Overview**: Dashboard (recharts AreaChart, health, recent activity)
**User Mgmt**: Users (search, role, ban, CSV export), User Detail (AI usage, rate limits)
**Content**: Content (4 tabs: Forum/Chat/Reviews/AI Moderation), Reports, Essays
**Academic**: Schools, Deadlines, Events, Points
**AI System**: AI Agent (8 sections), Memory (6 sections), Analytics (3 tabs: Token Usage/Engagement/Agent Performance)
**Platform**: Payments, Audit Logs (2 tabs: Admin/AI Agent), Settings

### Patterns

- **Section split**: Large pages → thin shell + `_components/*.tsx`, each section has own `useQuery`
- **Shared queryKeys**: React Query deduplication for components sharing same data
- **recharts theming**: CSS variables (`hsl(var(--primary))`) for dark mode
- **CSV export**: `GET /admin/export/:resource` returns `text/csv`
- **Broadcast**: `POST /admin/notifications/broadcast` with audience filter (ALL/VERIFIED/ADMIN)

## Code Review Checklist

After writing code, verify these items. `[AUTO]` items are enforced by tooling; `[MANUAL]` items require human verification. Full standards: `docs/CODE_STANDARDS.md`.

### Backend PR

1. `[AUTO]` `@Body()` uses DTO class, not inline type
2. `[AUTO]` String DTO fields have `@MaxLength()`
3. `[AUTO]` AI routes have `@ThrottleAI()`
4. `[AUTO]` No `throw new Error()` in services
5. `[AUTO]` Service has `.spec.ts` test file
6. `[MANUAL]` Sensitive endpoints have `@Roles(Role.ADMIN)`
7. `[MANUAL]` DTO fields have `@ApiProperty()` for Swagger

### Frontend PR

1. `[AUTO]` Tailwind classes are static (no `${var}` interpolation)
2. `[AUTO]` Hardcoded colors have `dark:` variant
3. `[AUTO]` New page has sibling `loading.tsx`
4. `[AUTO]` No `console.log` in production code
5. `[AUTO]` Accessibility: images have alt, elements focusable
6. `[MANUAL]` Icon buttons have `aria-label`
7. `[MANUAL]` Uses `PageHeader` + `PageContainer` pattern
8. `[MANUAL]` No hardcoded user-facing strings (use i18n)

### Run All Checks

```bash
pnpm lint:all    # ESLint + frontend quality + backend quality + i18n
```

## File Index

| Category     | File                                                        | Purpose                                               |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Entry**    | `api/src/app.module.ts`                                     | Module imports, guard/interceptor/filter registration |
| **Auth**     | `api/src/modules/auth/auth.service.ts`                      | JWT, refresh rotation, brute force                    |
|              | `api/src/common/guards/jwt-auth.guard.ts`                   | Global JWT guard (`@Public()` to skip)                |
|              | `api/src/common/guards/roles.guard.ts`                      | Role-based access control                             |
| **Pipeline** | `api/src/common/interceptors/transform.interceptor.ts`      | Response envelope wrapping                            |
|              | `api/src/common/filters/http-exception.filter.ts`           | Global error handling                                 |
| **AI**       | `api/src/modules/ai/ai.service.ts`                          | Simple AI facade                                      |
|              | `api/src/modules/ai-agent/core/llm.service.ts`              | Resilient LLM service                                 |
|              | `api/src/modules/ai-agent/core/orchestrator.service.ts`     | Multi-agent orchestrator                              |
|              | `api/src/modules/ai-agent/config/agents.config.ts`          | Agent definitions                                     |
|              | `api/src/modules/ai-agent/config/tools.config.ts`           | Tool definitions                                      |
|              | `api/src/modules/ai-agent/tools/helpers/llm-json.helper.ts` | JSON extraction helper                                |
| **DB**       | `api/prisma/schema.prisma`                                  | Database schema (2046 lines)                          |
|              | `api/src/common/config/env.validation.ts`                   | Zod env var validation                                |
| **Frontend** | `web/src/components/providers/index.tsx`                    | Provider chain + AuthInitializer                      |
|              | `web/src/lib/api/client.ts`                                 | API client (auth, retry, unwrap)                      |
|              | `web/src/proxy.ts`                                          | Route protection + i18n                               |
|              | `web/src/stores/auth.ts`                                    | Auth state (Zustand)                                  |
|              | `web/src/lib/constants.ts`                                  | AI timeouts, cache times                              |
| **Shared**   | `packages/shared/src/types/index.ts`                        | Shared TypeScript types                               |
