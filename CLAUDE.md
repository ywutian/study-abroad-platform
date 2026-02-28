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

### Error Handling

- Backend: Throw `BadRequestException` for user errors; let `LLMProviderError` propagate for provider issues
- Frontend: Global `MutationCache.onError` handles toast; use `meta.skipGlobalErrorToast` to opt out
- AI Error Boundary: `<AIErrorBoundary feature="...">` wraps AI feature components

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

### Route Protection (`middleware.ts`)

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

- **Colors**: Use CSS vars (`text-foreground`, `bg-card`, `text-muted-foreground`) or semantic classes (`bg-success`, `bg-destructive`). When using hardcoded Tailwind colors (`bg-emerald-50`), MUST add `dark:` variant.
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
| `pnpm test`                      | Unit tests (API: Jest, Web: Vitest)     |
| `pnpm test:e2e`                  | E2E tests (requires running DB + Redis) |
| `pnpm format`                    | Prettier format all files               |

### URLs

- Web: http://localhost:4100 | API: http://localhost:4101 | Swagger: http://localhost:4101/api/docs | Prisma Studio: http://localhost:5555

## CI/CD & Git Conventions

### GitHub Actions

- `ci.yml` (on push/PR): lint → typecheck → test → build (parallel jobs)
- `deploy-gcp.yml` (manual): Build → push to Artifact Registry → deploy to Cloud Run → smoke test → auto-rollback on failure
- E2E uses `pgvector/pgvector:pg16` + `redis:7-alpine` service containers

### Commit Convention (commitlint)

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### Pre-commit Hooks (Husky + lint-staged)

1. Prettier + ESLint on staged `.ts/.tsx` files
2. i18n checks (when `apps/web/src/` changed): missing keys, key consistency, wrong-language detection

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
|              | `web/src/middleware.ts`                                     | Route protection + i18n                               |
|              | `web/src/stores/auth.ts`                                    | Auth state (Zustand)                                  |
|              | `web/src/lib/constants.ts`                                  | AI timeouts, cache times                              |
| **Shared**   | `packages/shared/src/types/index.ts`                        | Shared TypeScript types                               |
