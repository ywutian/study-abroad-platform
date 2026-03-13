# Engineering Standards

Definitive reference for coding conventions, quality gates, and engineering standards in the Study Abroad Platform monorepo. All contributors must follow these standards.

---

## 1. Code Quality Gates (Automated)

Three layers of automated enforcement prevent common issues from reaching production.

### 1.1 Pre-commit Hooks

Configured in `.husky/pre-commit`. Runs automatically on every `git commit`.

**Stage 1 -- lint-staged** (all commits):

| File pattern                  | Actions                      |
| ----------------------------- | ---------------------------- |
| `*.{ts,tsx}`                  | Prettier format + ESLint fix |
| `*.{js,jsx,json,md,yml,yaml}` | Prettier format              |

**Stage 2 -- i18n checks** (when `apps/web/src/` files are staged):

1. `check-missing-keys.ts` -- source code keys exist in `zh.json`
2. `check-translation-keys.ts` -- `zh.json` and `en.json` key consistency
3. `check-wrong-language.ts` -- translation values are in the correct language

Fix missing keys: `pnpm --filter web exec npx tsx scripts/check-missing-keys.ts --fix`

**Stage 3 -- code quality checks** (when `apps/web/src/` files are staged):

Runs `check-code-quality.ts --staged` (see section 1.3).

Skip hooks only in emergencies: `git commit --no-verify`

### 1.2 CI Pipeline

Defined in `.github/workflows/ci.yml`. Triggers on push to `main`/`develop` and PRs.

**Parallel jobs:**

| Job            | Steps                                                                                                 | Blocks merge?                   |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Lint**       | ESLint (API + Web + Mobile) -> i18n checks -> code quality checks -> commitlint (PRs) -> `pnpm audit` | Yes (except Mobile lint, audit) |
| **Type Check** | `tsc --noEmit` for API, Web, Mobile                                                                   | Yes (except Mobile)             |
| **Unit Tests** | Jest (API with coverage) + Vitest (Web)                                                               | Yes                             |
| **E2E Tests**  | Prisma migrate -> seed -> Jest e2e (pgvector/pg16 + redis:7-alpine)                                   | Yes                             |
| **Doc Check**  | API docs sync, schema docs sync, broken link detection                                                | Warning only                    |
| **Build**      | Build API + Web (after lint + typecheck + test pass)                                                  | Yes                             |
| **Security**   | Trivy vulnerability scan (CRITICAL + HIGH)                                                            | Yes                             |

**Post-merge (main only):** Docker build + push, SBOM generation, GCP deploy with smoke test + auto-rollback.

### 1.3 Custom Quality Checks (check-code-quality.ts)

Location: `apps/web/scripts/check-code-quality.ts`

```bash
# Full scan
pnpm --filter web lint:quality

# Staged files only (used by pre-commit)
pnpm --filter web lint:quality --staged
```

| Rule                   | Severity                  | What it catches                                                                       | Fix                                          |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `no-dynamic-tailwind`  | **error** (blocks commit) | `` `bg-${color}-500` `` dynamic Tailwind interpolation -- purged in production builds | Use a static class map (see section 2.1)     |
| `no-hardcoded-dark-bg` | warning                   | `bg-slate-800` or `text-slate-300` without a `dark:` variant                          | Use CSS variables or add `dark:` variant     |
| `page-size-limit`      | warning                   | `page.tsx` exceeding 800 lines without a `_components/` directory                     | Split into thin page.tsx + `_components/`    |
| `no-console-in-prod`   | warning                   | `console.log` / `console.error` in production code                                    | Use toast for user errors, remove debug logs |

**Exemptions** (files that bypass specific rules):

- `no-dynamic-tailwind`: Files using full class strings from constant objects (e.g., `vault-create-dialog.tsx`, `onboarding-guide.tsx`)
- `no-hardcoded-dark-bg`: `globals.css`, `tailwind.config`, test files, `loading.tsx`
- `no-console-in-prod`: `error.tsx`, `error-boundary`, test files, `scripts/`

In CI, **all** issues (warnings included) are reported but only `error`-severity issues fail the build.

---

## 2. Frontend Standards

### 2.1 Tailwind CSS Rules

**Never dynamically interpolate Tailwind class names.** Tailwind's JIT compiler scans source files for static class strings at build time. Dynamic interpolation produces classes that cannot be detected and will be purged from the production CSS bundle.

```typescript
// BAD -- these classes will be purged in production
className={`bg-${color}-500/10 text-${color}-600`}
className={`text-${size}`}

// GOOD -- use a static class map
const COLOR_CLASSES = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600' },
} as const;

className={`${COLOR_CLASSES[color].bg} ${COLOR_CLASSES[color].text}`}
```

Reading from a constant object (e.g., `obj[key]` or `obj.prop`) where the object contains complete class strings is safe and recognized by the quality checker.

**Prefer CSS variables over hardcoded Tailwind colors:**

```typescript
// BEST -- semantic CSS variables (auto light/dark)
className = 'bg-background text-foreground';
className = 'bg-card text-muted-foreground';
className = 'bg-success bg-destructive';

// ACCEPTABLE -- hardcoded Tailwind color WITH dark: variant
className = 'bg-emerald-50 dark:bg-emerald-950';

// BAD -- hardcoded Tailwind color WITHOUT dark: variant
className = 'bg-slate-800'; // broken in light mode or missing dark mode
```

### 2.2 Dark Mode

The app uses `next-themes` with class-based toggling. The OKLCH color system in `globals.css` provides 50+ CSS custom properties per theme.

**Priority order for color usage:**

1. CSS variables via utility classes: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`
2. Semantic classes: `bg-success`, `bg-destructive`, `text-accent-foreground`
3. Hardcoded Tailwind colors with `dark:` variant: `bg-emerald-50 dark:bg-emerald-950`

**Auth pages** must use `--auth-*` CSS variables (automatically handle light/dark) -- never hardcode colors on auth pages.

### 2.3 Page Structure (PageHeader, PageContainer, \_components/)

**All feature pages** must use `PageHeader` + `PageContainer`:

```tsx
export default function FeaturePage() {
  return (
    <PageContainer maxWidth="2xl">
      <PageHeader
        title="Feature Name"
        icon={IconComponent}
        color="blue"  // blue | violet | amber | emerald | rose | slate | indigo
        stats={[...]}
        actions={<Button>Action</Button>}
      />
      {/* Page content */}
    </PageContainer>
  );
}
```

**Page split pattern** -- pages exceeding approximately 500 lines must be decomposed:

1. Thin `page.tsx` that orchestrates layout and data fetching
2. `_components/` directory with self-contained `'use client'` components
3. Each extracted component manages its own state where possible

```
app/[locale]/(main)/feature/
  page.tsx              # Thin orchestrator (<200 lines)
  _components/
    feature-header.tsx  # 'use client', own useQuery
    feature-list.tsx    # 'use client', own state
    feature-stats.tsx   # 'use client', own useQuery
```

The `page-size-limit` quality check warns at 800 lines (admin pages are exempt as they already follow the split pattern).

### 2.4 State Management

| Concern      | Solution                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| Server state | `@tanstack/react-query` (staleTime: 5min, retry: 1)                                |
| Auth state   | Zustand store (`@/stores/auth`) -- access token in-memory only, never localStorage |
| UI state     | React `useState` / `useReducer` local to components                                |
| Theme        | `next-themes` via `ThemeProvider`                                                  |

**React Query defaults** (from `query-provider.tsx`):

- `staleTime`: 5 minutes
- `queries.retry`: 1
- `mutations.retry`: 0

Use `STALE_TIME` and `GC_TIME` constants from `@/lib/constants` for cache tuning:

```typescript
import { STALE_TIME, GC_TIME } from '@/lib/constants';

useQuery({
  queryKey: ['schools', id],
  queryFn: () => apiClient.get(`/schools/${id}`),
  staleTime: STALE_TIME.STATIC, // 30min for rarely-changing data
  gcTime: GC_TIME.AI_ANALYSIS, // 10min for AI results
});
```

### 2.5 Error Handling

**Global error handling** is centralized in `query-provider.tsx`:

- `QueryCache.onError` -- shows toast only for queries that already have cached data (avoids toast on initial load failures)
- `MutationCache.onError` -- shows toast for all mutation errors, except:
  - When `meta.skipGlobalErrorToast` is set to `true`
  - For 403 and 500+ errors (already handled by `apiClient`)

```typescript
// To suppress the global error toast for a specific mutation:
const mutation = useMutation({
  mutationFn: (dto) => apiClient.post('/endpoint', dto),
  meta: { skipGlobalErrorToast: true },
  onError: (error) => {
    // Handle error locally instead
  },
});
```

**AI requests** must use the dedicated timeout:

```typescript
import { AI_TIMEOUTS } from '@/lib/constants';

const mutation = useMutation({
  mutationFn: (dto) => apiClient.post('/ai/review', dto, { timeout: AI_TIMEOUTS.AI_REQUEST }), // 120s
});
```

**AI Error Boundary:** Wrap AI feature components with `<AIErrorBoundary feature="...">`.

### 2.6 i18n

- Framework: `next-intl` with `{en, zh}` locales
- Message files: `apps/web/src/messages/{en,zh}.json`
- Navigation: Use `Link` and `useRouter` from `@/lib/i18n/navigation` (not from `next/link` directly)
- Admin keys: Namespaced under `admin.*`
- No hardcoded user-facing strings in components -- all text must go through `useTranslations()`

Three automated checks enforce i18n consistency (see section 1.1).

### 2.7 Console Usage

**No `console.log` or `console.error` in production code.**

| Scenario             | What to use instead                                                  |
| -------------------- | -------------------------------------------------------------------- |
| User-facing error    | `toast.error(message)` via sonner                                    |
| Debug logging        | Remove before commit                                                 |
| Development-only log | Guard with `if (process.env.NODE_ENV === 'development')`             |
| Error boundaries     | `console.error` is allowed in `error.tsx` and `error-boundary` files |
| Deprecation notices  | `console.warn` is allowed (not flagged by quality checker)           |

---

## 3. Backend Standards

### 3.1 Exception Handling

**Use NestJS built-in exceptions** -- never throw raw `Error` objects from service/controller code.

```typescript
// BAD -- bypasses NestJS exception layer, returns generic 500
throw new Error('User not found');

// GOOD -- proper HTTP semantics, structured error response
import { NotFoundException, BadRequestException } from '@nestjs/common';
throw new NotFoundException('User not found');
throw new BadRequestException('Invalid email format');
```

Raw `throw new Error()` is only acceptable in:

- Module bootstrap code
- Environment variable validation (`env.validation.ts`)
- Prisma seed scripts

**Silent catch blocks** must be specific about which errors they swallow:

```typescript
// BAD -- silently swallows all errors including real bugs
try {
  await this.prisma.user.delete({ where: { id } });
} catch (e) {
  // ignore
}

// GOOD -- only ignore "record not found" (P2025), rethrow everything else
try {
  await this.prisma.user.delete({ where: { id } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return; // Already deleted, idempotent
  }
  throw e;
}
```

The `AllExceptionsFilter` (in `common/filters/http-exception.filter.ts`) automatically maps:

| Source                          | HTTP Status        | Error Code             |
| ------------------------------- | ------------------ | ---------------------- |
| `HttpException` subclasses      | Exception's status | Derived from status    |
| Prisma P2002 (unique violation) | 409                | `DUPLICATE_ENTRY`      |
| Prisma P2025 (not found)        | 404                | `NOT_FOUND`            |
| Prisma P2003 (foreign key)      | 400                | `FOREIGN_KEY_ERROR`    |
| Prisma P1001/P1002 (connection) | 503                | `DATABASE_UNAVAILABLE` |
| Prisma P2024 (timeout)          | 504                | `QUERY_TIMEOUT`        |
| Unhandled `Error`               | 500                | `INTERNAL_ERROR`       |

### 3.2 Response Format

The `TransformInterceptor` (in `common/interceptors/transform.interceptor.ts`) automatically wraps all successful responses. **Never manually construct the envelope.**

```typescript
// BAD -- double-wrapped response
return {
  success: true,
  data: { user },
  meta: { timestamp: new Date().toISOString() },
};

// GOOD -- just return the data, interceptor wraps it
return { user };
```

The interceptor produces:

```json
{
  "success": true,
  "data": { "user": { ... } },
  "meta": {
    "timestamp": "2026-03-10T12:00:00.000Z",
    "correlationId": "uuid",
    "responseTimeMs": 42
  }
}
```

Error responses (from `AllExceptionsFilter`):

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested record was not found",
    "timestamp": "2026-03-10T12:00:00.000Z",
    "path": "/api/v1/users/999",
    "correlationId": "uuid"
  }
}
```

**Frontend note:** `apiClient` unwraps `response.data` automatically -- component code receives the inner `data` object directly.

### 3.3 Authentication & Guards

**All endpoints require JWT by default.** The `JwtAuthGuard` is registered globally in `app.module.ts`.

```typescript
// Public endpoint (no auth required) -- login, register, health, verify-email
@Public()
@Post('login')
async login(@Body() dto: LoginDto) { ... }

// Admin-only endpoint
@Roles(Role.ADMIN)
@Get('users')
async listUsers() { ... }

// Default: requires valid JWT (no decorator needed)
@Get('profile')
async getProfile(@CurrentUser() user: JwtPayload) { ... }
```

**Request lifecycle order:**

1. `CorrelationIdMiddleware` -- assigns `X-Correlation-ID`
2. `TimeoutMiddleware` -- 30s default, 120s for AI routes
3. `ThrottlerGuard` -- 100 requests / 60s per IP
4. `JwtAuthGuard` -- JWT validation (skip with `@Public()`)
5. `RolesGuard` -- role check (via `@Roles()`)
6. `SanitizeInterceptor` -- XSS prevention
7. `SentryInterceptor` -- error tracking
8. `TransformInterceptor` -- response wrapping
9. `LoggingInterceptor` -- request/response logging

### 3.4 JSON from LLM

**Always use `extractJsonFromLlm()`** to parse JSON from LLM responses. Never use raw regex extraction.

```typescript
// BAD -- fragile, fails on nested objects, no fallback
const match = response.match(/\{[\s\S]*\}/);
const data = JSON.parse(match![0]);

// GOOD -- handles markdown code blocks, arrays, fallback
import { extractJsonFromLlm } from '../ai-agent/tools/helpers/llm-json.helper';
const data = extractJsonFromLlm<MyResponseType>(llmResponse);
```

`extractJsonFromLlm` handles:

1. Direct JSON parse (pure JSON responses)
2. JSON object extraction from surrounding text
3. JSON array extraction
4. Fallback to `{ result: rawString }` if all parsing fails

Location: `apps/api/src/modules/ai-agent/tools/helpers/llm-json.helper.ts`

### 3.5 Logging

**Use the NestJS `Logger` service**, not `console.log`.

```typescript
// BAD
console.log('User created:', userId);
console.error('Failed to send email', error);

// GOOD
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async createUser(dto: CreateUserDto) {
    this.logger.log(`Creating user: ${dto.email}`);
    // ...
    this.logger.warn(`Email delivery delayed for ${dto.email}`);
    this.logger.error(`Failed to create user: ${dto.email}`, error.stack);
  }
}
```

The `LoggingInterceptor` automatically logs all request/response pairs with timing and masks PII fields.

---

## 4. Shared Standards

### 4.1 TypeScript Strictness

All three apps and the shared package use `"strict": true` in their `tsconfig.json`.

| App                        | Target | Module                      |
| -------------------------- | ------ | --------------------------- |
| API (`apps/api`)           | ES2023 | NodeNext                    |
| Web (`apps/web`)           | ES2017 | ESNext (bundler resolution) |
| Shared (`packages/shared`) | ES2020 | Node16                      |

Key strictness rules enforced:

- `strict: true` (enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.)
- `forceConsistentCasingInFileNames: true` (API, Shared)
- `noFallthroughCasesInSwitch: true` (API)
- `isolatedModules: true` (API, Web)

**Avoid `any`** -- use Prisma-generated types, shared types from `@study-abroad/shared`, or define explicit interfaces.

### 4.2 Type Definitions

**All shared AI types** live in `packages/shared/src/types/index.ts`:

- `AgentType`, `StreamEvent`, `ActionButton`, `Message`, `ToolCall`
- `PredictionResult`, `RecommendationResult`, `AIAnalysisResult`

**Rules:**

- Never duplicate types that exist in `@study-abroad/shared`
- Frontend-only UI types stay local to their component files
- DTOs in the API use `class-validator` decorators and live in their module's `dto/` directory

### 4.3 Import Conventions

**Frontend (`apps/web`):**

```typescript
// Path alias for all local imports
import { Component } from '@/components/ui/component';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth';

// Shared package
import { AgentType } from '@study-abroad/shared';

// i18n navigation (NOT from next/link)
import { Link, useRouter } from '@/lib/i18n/navigation';
```

**Backend (`apps/api`):**

```typescript
// Relative imports within a module
import { CreateUserDto } from './dto/create-user.dto';

// Common utilities via relative path from module
import { extractJsonFromLlm } from '../ai-agent/tools/helpers/llm-json.helper';

// NestJS decorators and utilities
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
```

**Module dependency rules** (backend):

- `ai-agent/security/` -- `@Global()`, no imports needed
- `ai-agent/providers/` -- `global: true` via `forRoot()`, no imports needed
- `ai-agent/memory/` -- import `AiAgentMemoryModule` for `MemoryManagerService`
- `ai-agent/` -- import `AiAgentModule` for `OrchestratorService`, `TokenTrackerService`
- `ai/` -- import `AiModule` for `AiService`
- `AiModule` does NOT import `AiAgentModule` (no circular dependencies)
- Never import a service directly from another module's internal files without importing that module

### 4.4 Naming Conventions

| Type                  | Convention                | Example                  |
| --------------------- | ------------------------- | ------------------------ |
| File names            | kebab-case                | `school-data.service.ts` |
| Classes               | PascalCase                | `SchoolDataService`      |
| Functions / variables | camelCase                 | `getSchoolById`          |
| Constants             | UPPER_SNAKE_CASE          | `MAX_RETRY_COUNT`        |
| DTOs                  | PascalCase + `Dto` suffix | `CreateSchoolDto`        |
| Database models       | PascalCase                | `AdmissionCase`          |
| React components      | PascalCase                | `SchoolListCard`         |
| Component files       | kebab-case                | `school-list-card.tsx`   |
| CSS variables         | `--kebab-case`            | `--primary-foreground`   |

---

## 5. Testing Standards

### Test Framework

| App            | Framework                                                  | Config                        |
| -------------- | ---------------------------------------------------------- | ----------------------------- |
| API unit tests | Jest + `@nestjs/testing`                                   | `apps/api/jest.config.ts`     |
| API E2E tests  | Jest                                                       | `apps/api/test/jest-e2e.json` |
| Web unit tests | Vitest                                                     | `apps/web/vitest.config.ts`   |
| E2E (CI)       | pgvector/pgvector:pg16 + redis:7-alpine service containers | `.github/workflows/ci.yml`    |

### Coverage Targets

- New code: >= 80% coverage
- Critical paths (auth, payments, data mutations): >= 90% coverage

### Test Patterns

**Backend unit tests:**

- Mock external dependencies (Prisma, Redis, HTTP calls)
- Test normal path + error path + boundary cases
- New services must have a corresponding `.spec.ts` file

```typescript
// Example: mock Prisma in a NestJS test
const module = await Test.createTestingModule({
  providers: [
    UserService,
    { provide: PrismaService, useValue: mockPrismaService },
    { provide: RedisService, useValue: mockRedisService },
  ],
}).compile();
```

### Running Tests

```bash
# API unit tests
pnpm --filter api test

# API tests with coverage
pnpm --filter api test -- --coverage

# Specific test file
pnpm --filter api test -- --testPathPattern=user.service

# Web unit tests
pnpm --filter web test

# E2E tests (requires running DB + Redis)
pnpm test:e2e
```

---

## 6. Git & PR Standards

### Commit Convention

Enforced by Husky + commitlint. Non-conforming commits are rejected.

Format: `<type>(<scope>): <subject>`

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes** (optional): `auth`, `profile`, `school`, `case`, `ai`, `forum`, `web`, `api`, `mobile`

```
feat(prediction): add percentile-based SAT scoring

Implements SAT 25th/75th percentile scoring using College Scorecard data.
Falls back to average SAT when percentile data is unavailable.

Closes #42
```

### Branch Strategy

| Branch type | Naming                   | Source    | Merge target       |
| ----------- | ------------------------ | --------- | ------------------ |
| Feature     | `feature/<description>`  | `develop` | `develop`          |
| Fix         | `fix/<description>`      | `develop` | `develop`          |
| Hotfix      | `hotfix/<description>`   | `main`    | `main` + `develop` |
| Docs        | `docs/<description>`     | `develop` | `develop`          |
| Refactor    | `refactor/<description>` | `develop` | `develop`          |

Branch names: lowercase English + hyphens (e.g., `feature/add-school-filter`). Max lifetime: 1 week.

### Pull Request Requirements

1. **Before creating a PR:**
   - `pnpm lint` passes
   - `pnpm --filter web lint:quality` passes
   - `pnpm --filter api test` passes
   - Related documentation updated
   - Branch rebased onto latest target branch

2. **PR description** must include: Summary, Changes, Test Plan, Checklist

3. **Review requirements:**
   - At least 1 maintainer approval
   - All CI checks pass
   - All comments resolved
   - Squash merge (clean main branch history)

4. **Review focus areas:**
   - Type safety (avoid `any`)
   - Error handling (NestJS exceptions on backend, toast on frontend)
   - Tailwind classes are statically analyzable
   - Colors have dark mode support
   - Pages are not too long (>500 lines should be split)
   - No residual `console.log`
   - Security (user input handling, auth checks)

---

## 7. Documentation Standards

### When to Update Docs

| Change                 | Document to update              |
| ---------------------- | ------------------------------- |
| New API endpoint       | `docs/API_REFERENCE.md`         |
| Architecture decision  | New ADR in `docs/adr/NNNN-*.md` |
| Database schema change | `docs/ARCHITECTURE.md`          |
| Bug fix or new feature | `CHANGELOG.md`                  |
| New module or pattern  | `CLAUDE.md` (development guide) |

CI automatically warns (non-blocking) when:

- Controller files change but `API_REFERENCE.md` is not updated
- `schema.prisma` changes but `ARCHITECTURE.md` is not updated
- Documentation contains broken internal links

### Inline Documentation

- Public APIs and services: JSDoc with `@param`, `@returns`, `@throws`
- Complex business logic: Inline comments explaining "why", not "what"
- DTOs: Use `class-validator` decorators and `@ApiProperty()` for Swagger documentation
- TODO comments: Use `// TODO(username): description` format with owner
