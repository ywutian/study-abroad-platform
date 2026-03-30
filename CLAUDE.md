# Study Abroad Platform — Development Guide

## Agent 工作流（必须遵守）

13 个专项 Agent 覆盖不同审查维度。每个 Agent 内置 **Step 0 相关性判断**：明确无关时快速返回 N/A，不确定时继续审查（宁可多审不可漏审）。

| #   | Agent          | 文件                                     | 职责                                                    |
| --- | -------------- | ---------------------------------------- | ------------------------------------------------------- |
| 1   | **留学专家**   | `.claude/agents/study-abroad-expert.md`  | 验证业务逻辑符合真实美本申请实践                        |
| 2   | **申请者模拟** | `.claude/agents/applicant-simulator.md`  | 以高中生+家长视角审查易用性和实用性                     |
| 3   | **设计审查**   | `.claude/agents/design-reviewer.md`      | UI/UX、暗色模式、响应式、无障碍审查                     |
| 4   | **架构师**     | `.claude/agents/architect.md`            | 系统架构、API 设计、模块依赖、性能                      |
| 5   | **闭环检查**   | `.claude/agents/integration-checker.md`  | 前后端对接、类型一致、权限、错误处理、文档更新          |
| 6   | **数据模型**   | `.claude/agents/data-model-reviewer.md`  | Schema→DTO→Select→Mapper→共享类型→前端 全链路一致性     |
| 7   | **安全审查**   | `.claude/agents/security-reviewer.md`    | 认证授权、注入防护、数据泄露、隐私合规、OWASP Top 10    |
| 8   | **AI Prompt**  | `.claude/agents/ai-prompt-engineer.md`   | Prompt 质量、幻觉控制、token 效率、输出可靠性           |
| 9   | **i18n 专家**  | `.claude/agents/i18n-specialist.md`      | 翻译质量、术语一致、key 完整性、中英文布局适配          |
| 10  | **测试工程**   | `.claude/agents/test-engineer.md`        | 测试覆盖、测试质量、边界用例、回归验证                  |
| 11  | **移动端专家** | `.claude/agents/mobile-specialist.md`    | Expo/RN 兼容性、移动性能、离线、原生功能、与 web 一致性 |
| 12  | **反馈处理**   | `.claude/agents/feedback-processor.md`   | 外部反馈分诊、根因分类、验收标准、防止返工              |
| 13  | **用户旅程**   | `.claude/agents/user-journey-auditor.md` | 从用户视角审查功能完整性、体验连贯性、错误恢复          |

### 两阶段工作流

#### 阶段一：方案审查（按变更类型分组）

制定实现方案时，按下表启动对应 Agent 组进行并行审查。**判断不准时宁可多启动**——Agent 内置 Step 0 会自动过滤无关审查，多启动的成本很低（N/A 早退 ~10 秒）。

| 变更类型                                | 启动 Agent                                                | 按需叠加                                                               |
| --------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| **后端开发**                            | 架构师、数据模型、安全审查、测试工程                      | AI Prompt（涉及 LLM 调用时）                                           |
| **前端开发**                            | 设计审查、i18n 专家、申请者模拟、测试工程                 | —                                                                      |
| **移动端开发**                          | 移动端专家、i18n 专家、申请者模拟、测试工程               | —                                                                      |
| **AI 功能**                             | AI Prompt、留学专家、安全审查、测试工程                   | —                                                                      |
| **全栈功能**                            | 架构师、数据模型、设计审查、i18n 专家、安全审查、测试工程 | 留学专家（涉及业务）、AI Prompt（涉及 LLM）、移动端专家（涉及 mobile） |
| **数据库变更**                          | 数据模型、架构师、安全审查                                | —                                                                      |
| **留学业务逻辑**                        | 留学专家、申请者模拟                                      | + 对应开发类型的 Agent 组                                              |
| **大型变更**（新模块/架构重构/DB 迁移） | **全部 13 个 Agent 并行**                                 | —                                                                      |

#### 阶段二：验收闭环（强制）

开发完成后 **必须** 执行：

1. **闭环检查** `integration-checker` — 验证前后端对接、类型一致、i18n 覆盖、权限、错误处理
2. **测试工程** `test-engineer` — 运行测试、补充缺失测试、验证通过
3. **用户旅程** `user-journey-auditor` — 涉及用户可见功能时，审查受影响旅程的完整性和体验（审计模板：`docs/templates/user-journey-audit.md`，记录：`docs/USER_JOURNEY_AUDIT_LOG.md`）
4. **闭环检查**负责更新 CLAUDE.md / MEMORY.md 文档，并提醒在旅程注册表中登记新增的用户可见功能

### 规则

- 可并行的 Agent **必须并行启动**，提高效率
- 每个 Agent 的意见都必须在最终方案/代码中有体现或有明确回应
- Agent 返回 N/A 视为该维度审查通过，无需额外回应
- **Prisma Model 变更必须执行消费者扫描**：当计划涉及增/改 Prisma Model 字段时，架构师和数据模型 Agent 必须执行 `grep -r "ModelName" --include="*.ts" --include="*.tsx"` 全量扫描，列出所有读写该 Model 的消费者（后端 Service、Admin 表单、用户端 UI、Mobile），逐一标注"需更新"或"无需更新（原因）"。计划中的文件清单必须**影响面驱动**而非仅需求驱动。
- **新增 nullable 字段的前端处理**：新增字段在前端渲染时，**禁止**用 `|| '某个具体枚举值'` 作为默认值（因为现有数据全是 null，会误导用户）。必须显示通用/未知状态，明确区分"已标注"和"未标注"。

### 边界案例判断规则（变更类型交叉时）

当变更跨越多个关注点时，除了变更类型表中的基础 Agent 组，还需按以下规则追加 Agent：

- Prisma Model 字段出现在前端 UI 渲染中 → 追加**设计审查**
- 改变 LLM 输出结构（JSON schema、返回字段） → 追加**数据模型**
- 改变 API 错误码或错误响应结构 → 追加**闭环检查**
- 改变 `packages/shared` 中的类型定义 → 追加**移动端专家**（如 mobile 使用该类型）
- 新增 nullable 字段且有前端展示 → 追加**申请者模拟**（确认"未知"状态对用户是否清晰）
- prompt 输出结果用于业务决策（如录取预测） → 追加**留学专家**（确认业务合理性）

## Feedback Processing Workflow (外部反馈处理)

收到外部用户/测试者反馈时，**必须**按以下流程处理，不允许跳过分诊直接编码。

### 5 阶段流程

#### 阶段一：分诊与分类

使用 `docs/templates/feedback-triage.md` 模板，逐条反馈执行：

1. 归类为 5 类之一：`CODE_BUG` | `DATA_ISSUE` | `UX_CONFUSION` | `NEW_FEATURE` | `INDUSTRY_SUGGESTION`
2. 分析技术根因（具体到文件名 + 行号）
3. 定义验收标准（**必须是用户可见结果**，不是"代码改了"）
4. 有歧义的条目 → 问用户做决定，不自行假设

启动 `feedback-processor` Agent 辅助分诊。

#### 阶段二：批次规划（每批 ≤ 3 条）

按相关性分组，每批最多 3 条。每批方案按变更类型启动对应 Agent 组审查（同阶段一工作流）。

#### 阶段三：增量实现

每个批次：

1. 实现代码变更
2. 提交前运行 `npx tsx scripts/verify-gate.ts --staged`
3. 全部 gate 通过后才提交

#### 阶段四：验收验证

逐条验证验收标准（不只是"编译通过"）：

- `CODE_BUG`：复现场景 → 确认输出正确
- `DATA_ISSUE`：用真实数据测试 → 确认输出有意义
- `UX_CONFUSION`：以新用户视角审查 → 确认无歧义
- `NEW_FEATURE`：端到端演示完整功能
- `INDUSTRY_SUGGESTION`：留学专家 Agent 确认业务准确性

**核心原则：代码改了 ≠ 问题解决了**。状态保持 `open` 直到验收通过。

#### 阶段五：发布与记录

1. 全部 pre-push gate 通过后推送
2. 更新 `docs/USER_FEEDBACK_ANALYSIS_*.md` 记录解决方案
3. 分诊表中标记 `verified`

### 验证门控脚本

```bash
npx tsx scripts/verify-gate.ts            # 检查所有未提交变更
npx tsx scripts/verify-gate.ts --staged   # 仅检查已暂存文件
npx tsx scripts/verify-gate.ts --verbose  # 显示跳过的检查及原因
```

自动检测受影响的 app（api/web/mobile/shared），仅运行相关的 typecheck + test + lint:routes + lint:i18n。

## Architecture Overview

Turbo monorepo with pnpm workspaces:

- `apps/api` — NestJS 11 backend (PostgreSQL + Prisma, Redis)
- `apps/web` — Next.js 16 frontend (React 19, Tailwind, next-intl)
- `apps/mobile` — Expo 54 (React Native)
- `packages/shared` — Shared types, constants, scoring algorithms

## Backend Modules

29 domain modules in `apps/api/src/modules/` — see `app.module.ts` for the full list and registration order. Key architectural patterns: thin facade services (profile, forum, hall, timeline), enterprise sub-service orchestration (prediction: 13 sub-services), WebSocket gateway (`chat` at `/chat` namespace). Infrastructure in `apps/api/src/common/`: prisma, redis, logger, email, storage, sentry, feature-flags, authorization, audit-log — all `@Global()`.

## Request Lifecycle

Pipeline order (defined in `app.module.ts`): Middleware (CorrelationId → Timeout) → Guards (Throttler → JwtAuth → Roles → Permission → FeatureFlag) → Interceptors (Sanitize → Sentry → Transform → Logging) → AllExceptionsFilter. See `app.module.ts` for registration details.

## Authentication & Authorization

### Role Hierarchy: `ADMIN` > `VERIFIED` > `USER`. ADMIN overrides all checks.

### Decorators (Rules)

- `@Public()` — skip JWT auth (used on login, register, health, verify-email)
- `@Roles(Role.ADMIN)` — require specific role
- `@CurrentUser()` — extract user from request: `{ id, email, role, locale }`

### Frontend Auth Rules

- Access token stored **in-memory only** (Zustand store — never localStorage)
- Refresh token in **httpOnly cookie** — inaccessible to JS
- Only `AuthInitializer` owns the refresh interval — not `setAuthFromLogin`

## Response Format

- `TransformInterceptor` wraps all responses as `{ success, data, meta }` — **never manually build this envelope**
- `AllExceptionsFilter` maps errors to `{ success: false, error: { code, message, ... } }` — see filter for Prisma error mappings
- Frontend `apiClient` unwraps `response.data` automatically — component code receives inner object directly

## AI System Architecture

> Full details: see `memory/ai-system.md` for module map, LLM call chains, tool system, memory system, and admin endpoints.

### LLM Provider Abstraction

All LLM calls go through `ILLMProvider` interface (`ai-agent/providers/`). Provider selected by `LLM_PROVIDER` env var (default: `openai`). `LLMProvidersModule.forRoot()` is `global: true` and also provides `LLMService`, `ResilienceService`, and `TokenTrackerService` as global singletons — ensuring shared circuit breaker state and unified token tracking across the entire application.

### Unified LLM Service

All LLM calls go through `LLMService` (globally provided by `LLMProvidersModule.forRoot()`):

| Method                                        | Use case                 | Input                      | Output                        |
| --------------------------------------------- | ------------------------ | -------------------------- | ----------------------------- |
| `chatSimple(messages, options)`               | One-shot domain AI calls | `ChatSimpleMessage[]`      | `string`                      |
| `call(systemPrompt, messages, options)`       | Agent loop (with tools)  | `Message[]` + `LLMOptions` | `LLMResponse`                 |
| `callStream(systemPrompt, messages, options)` | Streaming agent loop     | `Message[]` + `LLMOptions` | `AsyncGenerator<StreamChunk>` |

`LLMOptions` supports `seed`, `providerOptions` (for `response_format`, etc.), `temperature`, `maxTokens`, `timeoutMs`.

**Note**: The legacy `AiService` has been removed. All consumers use `LLMService.chatSimple()` directly.

### Tool System

12 domain tool services implementing `IToolHandlerProvider`. See `memory/ai-system.md` for full list and how to add new tools.

### Memory System

Enterprise memory: Redis (hot) + PostgreSQL (cold) + pgvector (semantic search). See `memory/ai-system.md` for architecture.

### Security

`@Global() AgentSecurityModule`: PromptGuardService (injection detection), ContentModerationService (harmful content), AuditService (security event logging).

## Mandatory Patterns

### JSON Extraction from LLM Responses

```typescript
// ALWAYS use:
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
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

## OpenTelemetry (Distributed Tracing)

- `apps/api/src/tracing.ts` — OTel SDK initialization, imported as first line in `main.ts`
- **Conditionally enabled**: Only active when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Zero overhead when disabled.
- Auto-instruments: HTTP, Express, ioredis, Prisma queries
- Exports traces + metrics via OTLP HTTP to any compatible collector (Jaeger, GCP Cloud Trace, Datadog)
- Local testing: `docker run -d -p 4318:4318 -p 16686:16686 jaegertracing/all-in-one` → set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`

## Feature Flags

Database-backed feature flag system with Redis caching (60s TTL) and graceful degradation.

### Usage

```typescript
// Endpoint-level: entire route gated by flag
@FeatureFlag('prediction-v4')
@Post('prediction/v4')
async predictV4(@CurrentUser() user) { ... }

// Service-level: conditional logic within code
const enabled = await this.featureFlagService.isEnabled('new-algo', {
  userId: user.id,
  role: user.role,
});
```

### Key files

- `common/feature-flags/` — `@Global()` module, service (Redis + DB), guard, decorator
- `modules/admin/admin-feature-flag.controller.ts` — Admin CRUD (`/admin/feature-flags`)
- Prisma model: `FeatureFlag` → `feature_flags` table

### Rules JSON

```json
{ "roles": ["ADMIN"], "userIds": ["uuid-1"], "percentage": 50 }
```

Evaluation: roles → userIds → percentage (any match = enabled). `rules: null` + `enabled: true` = global rollout.

## Module Dependency Rules

```
ai-agent/security/  →  @Global(), no imports needed
ai-agent/providers/ →  global: true via forRoot(); provides LLMService, ResilienceService, TokenTrackerService
ai-agent/memory/    →  Import AiAgentMemoryModule for MemoryManagerService
ai-agent/           →  Import AiAgentModule for OrchestratorService
ai/                 →  Import AiModule for ProfileAiService, ResumeAiService
```

- `LLMService`, `ResilienceService`, `TokenTrackerService` are **globally** provided by `LLMProvidersModule.forRoot()` — no module import needed
- `extractJsonFromLlm` is imported from `common/utils/llm-json.util` (not from `ai-agent/`)
- `AiModule` provides only `ProfileAiService` and `ResumeAiService` (no `AiService`)
- Domain modules (Prediction, Essay, Recommendation, Hall, Profile) inject `LLMService` directly — no need to import `AiModule`
- External domain modules (Prediction, Assessment, Forum, Hall) are imported by `AiAgentModule` for tool service DI
- Never import a service directly from another module's internal files without importing the module

### Prompt File Convention

Each module with AI prompts has a dedicated `*.prompts.ts` file exporting builder functions:

- `buildXxxSystemPrompt(locale: string, ...context): string`
- `buildXxxUserPrompt(data, locale: string): string`

Examples: `ai/profile-ai.prompts.ts`, `ai/resume-ai.prompts.ts`, `recommendation/recommendation.prompts.ts`, `prediction/prediction.prompts.ts`, `essay/essay-ai.prompts.ts`

## Database

- **Schema**: `apps/api/prisma/schema.prisma` (~2460 lines, 28 enums, 50+ models)
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
  - CI/CD handles migration execution automatically — ci.yml deploy-gcp job runs `prisma migrate deploy` before service update, with auto-rollback on failure

## Environment Variables

Full Zod schema and defaults in `common/config/env.validation.ts` (source of truth). See `apps/api/.env.example` for all variables with comments. Required in production: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`, `VAULT_ENCRYPTION_KEY`.

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

#### i18n Check System (5 Layers)

| Layer | Script                       | Checks                           | Integration              |
| ----- | ---------------------------- | -------------------------------- | ------------------------ |
| 1     | `check-i18n.ts`              | Hardcoded Chinese in TSX         | pre-commit + CI          |
| 2     | `check-missing-keys.ts`      | `t()` calls without matching key | pre-commit + CI          |
| 3     | `check-translation-keys.ts`  | en/zh key consistency            | pre-commit + CI          |
| 4     | `check-wrong-language.ts`    | Wrong language in locale files   | pre-commit + CI          |
| 5     | `check-hardcoded-english.ts` | Hardcoded English (audit tool)   | manual / CI non-blocking |

**Full i18n audit workflow**:

1. `npx tsx scripts/check-hardcoded-english.ts --path <module>` — triage
2. Follow `scripts/i18n-audit-skill.md` for AI-guided per-file review
3. Add keys to `en.json` + `zh.json`, update components with `t()`
4. `pnpm --filter web lint:i18n` — verify layers 1–4

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
- **Overflow prevention (3-layer defense)**:
  - Layer 1 (global): `html`/`body` have `overflow-x: hidden` + `overflow-wrap: break-word` as safety net
  - Layer 2 (layout): `PageContainer` and `Card` have `overflow-hidden` built-in
  - Layer 3 (component): Any `flex` with `justify-between` **MUST** have `min-w-0` on the variable-width child and `shrink-0` on the fixed-width child. Text in flex items should use `truncate` or `line-clamp-N` when width is constrained.
  - Governance rule `flex-overflow-safety` detects violations at CI time

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
| `pnpm lint:routes`               | API route consistency check             |
| `pnpm format`                    | Prettier format all files               |

### URLs

- Web: http://localhost:4100 | API: http://localhost:4101 | Swagger: http://localhost:4101/api/docs | Prisma Studio: http://localhost:5555

## CI/CD & Git Conventions

### GitHub Actions

- `ci.yml` (on push/PR): detect-changes → lint / typecheck / test / e2e / secret-scan / sast / security (parallel) → build → docker / sbom / deploy-gcp
  - **Affected-only**: `dorny/paths-filter` detects which apps changed; jobs skip unaffected apps (push to main always runs all)
  - **Parallel steps**: lint/typecheck/test steps within each job run in parallel via `&` + `wait`
  - **Turbo remote cache**: `dtinth/setup-github-actions-caching-for-turbo` enables cross-run caching
  - **Security**: Trivy (CVE scan) + gitleaks (secret scan) + Semgrep (SAST, PR-only) + pnpm audit
  - **Migration safety**: `scripts/check-migration-safety.ts` runs in E2E job, catches dangerous SQL (NOT NULL without DEFAULT, non-concurrent indexes, etc.)
- `ci.yml` deploy-gcp job also supports `workflow_dispatch` for manual deploys (with same canary safety)
- `deploy-staging.yml` (auto on develop): Staging environment with reduced resources
- `preview.yml` (on PR): API preview deployment to Cloud Run via tagged revision (`--no-traffic --tag=pr-{N}`), comments preview URL on PR
- `preview-cleanup.yml` (on PR close): Removes the Cloud Run traffic tag for the closed PR
- E2E uses `pgvector/pgvector:pg16` + `redis:7-alpine` service containers
- **Dependabot**: `.github/dependabot.yml` — weekly npm (grouped by dev/prod), weekly GitHub Actions, monthly Docker

### Commit Convention (commitlint)

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### Git Hooks (Husky)

#### Pre-commit (lint-staged, ~5-10s)

1. **Prettier + ESLint** on staged `.ts/.tsx` files (includes import sorting via `simple-import-sort`)
2. **gitleaks** secret scan on staged files (if installed locally)
3. **i18n checks** (when `apps/web/src/` changed): missing keys, key consistency, wrong-language detection
4. **Frontend quality checks** (when `apps/web/src/` changed): 8 rules — dynamic Tailwind, hardcoded colors, console.log, page size, loading.tsx, error.tsx, tooltip-provider
5. **Backend quality checks** (when `apps/api/src/` changed): 7 rules — inline body, throttle, throw, maxlength, tests, duplicated select, select-mapping drift

#### Pre-push (~20-50s, catches CI failures locally)

`.husky/pre-push` runs before every `git push`:

1. **Prisma generate** — ensures client matches schema (prevents typecheck failures)
2. **Smart verification gate** (`verify-gate.ts`) — typecheck, tests, lint:routes, lint:i18n scoped to affected apps
3. **Migration safety** (conditional) — only if `prisma/migrations/` files changed, checks for dangerous SQL
4. **Dependency audit** — `pnpm audit --audit-level=high` catches CVEs before CI does

Manual equivalent: `pnpm prepush`

### CI ↔ Local Check Mapping

| CI Job                                     | Local Hook / Command                                                                 | Common Failure Causes                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Lint** (ESLint + i18n + quality + audit) | pre-commit + `pnpm lint:all`                                                         | i18n wrong-language, missing dark: variants, CVE in dependencies                            |
| **Type Check** (API + Web + Mobile)        | pre-push + `pnpm --filter <app> exec tsc --noEmit`                                   | Dynamic imports with nodenext resolution, wrong enum types in DTOs, missing Prisma generate |
| **Unit Tests**                             | pre-push + `pnpm test`                                                               | Missing Prisma mock models, coverage threshold too high, Zustand selector mock pattern      |
| **E2E Tests**                              | `pnpm test:e2e` (requires Docker PG + Redis)                                         | Renamed/removed API routes not updated in e2e specs, migration drift                        |
| **Mobile CI** (Lint & Test)                | pre-push                                                                             | Coverage thresholds, pnpm version mismatch in workflow                                      |
| **Secret Scan** (gitleaks)                 | pre-commit (if gitleaks installed locally)                                           | Accidental secrets in code (API keys, tokens, passwords)                                    |
| **SAST Scan** (Semgrep)                    | N/A (CI-only, PR only)                                                               | Code-level vulnerabilities: injection, XSS, eval(), unsafe deserialization                  |
| **Security Scan** (Trivy)                  | N/A (CI-only)                                                                        | CVEs in container image, Docker image CVEs — use `.trivyignore` to suppress                 |
| **Dead Code** (Knip)                       | `pnpm lint:dead-code` (CI: warning only, non-blocking)                               | Unused files, exports, dependencies — config in `knip.json`                                 |
| **Migration Safety**                       | pre-push (if migrations changed) + `pnpm exec tsx scripts/check-migration-safety.ts` | NOT NULL without DEFAULT, non-concurrent indexes, DROP TABLE/COLUMN                         |
| **Dependency Audit**                       | pre-push + `pnpm audit --audit-level=high --registry=https://registry.npmjs.org`     | Transitive dependency CVEs — fix with `pnpm.overrides` in root package.json                 |
| **Route Check**                            | pre-push + `pnpm lint:routes`                                                        | Client API path prefix not matching any backend `@Controller()` decorator                   |
| **Integration Check**                      | `pnpm lint:integration` (16 rules across 4 domains)                                  | Enum drift, dead route helpers, missing module imports, hardcoded API paths, stub services  |
| **Build**                                  | `pnpm build`                                                                         | Subset of typecheck issues                                                                  |

### Lessons Learned (Push Failures)

- **Prisma schema 变更后**：必须 `pnpm --filter api db:generate` 再 typecheck，否则类型不匹配
- **DTO 字段类型**：使用 Prisma 枚举类型（`import { MyEnum } from '@prisma/client'`），不要用 `string`
- **nodenext 模块解析**：跨模块引用必须用静态 `import`，不能用 `await import()`
- **测试 mock**：新增 Prisma model 后，所有 `PrismaService` mock 需要补充对应的 model mock
- **Zustand hook mock**：必须用 selector 模式 `jest.fn((selector) => selector ? selector(state) : state)`
- **Coverage 阈值**：新 app 初期阈值设低（3-5%），随测试增加逐步提高
- **依赖审计 CVE**：用 `pnpm.overrides` 修复传递依赖的 CVE，注意区分 major 版本范围
- **E2E 测试**：API 路由重命名/删除时，同步更新 `apps/api/test/*.e2e-spec.ts`
- **CI workflow**：`pnpm/action-setup@v4` 自动读取 `packageManager` 字段，不要手动指定 `version`

### Code Quality Checks (`check-code-quality.ts`)

Custom static analysis (8 rules) that catches issues ESLint can't:

| Rule                          | Severity                     | What it catches                                | Fix                                                                       |
| ----------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `no-dynamic-tailwind`         | **error** (blocks commit/CI) | `` `bg-${color}-500` `` — purged in production | Use static class map (`COLOR_CLASSES[color].bg`)                          |
| `no-hardcoded-dark-bg`        | warning                      | `bg-slate-800` without `dark:` variant         | Use CSS vars (`bg-background`) or add `dark:`                             |
| `no-hardcoded-gray`           | warning                      | `bg-gray-100`, `text-gray-600` without `dark:` | Use semantic classes (`bg-muted`, `text-muted-foreground`) or add `dark:` |
| `page-size-limit`             | warning                      | `page.tsx` >500 lines without `_components/`   | Split into thin orchestrator + `_components/`                             |
| `no-console-in-prod`          | warning                      | `console.log/error` in production code         | Use `toast` for user errors, remove debug logs                            |
| `no-missing-loading`          | warning                      | `page.tsx` without sibling `loading.tsx`       | Create Skeleton loading file                                              |
| `no-missing-error-boundary`   | warning                      | Route group without `error.tsx`                | Add error.tsx at route group level                                        |
| `no-tooltip-without-provider` | **error** (blocks commit/CI) | `Tooltip` imported without `TooltipProvider`   | Add `TooltipProvider` wrapper around `Tooltip` usage                      |

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
pnpm lint:all                          # One command: ESLint + quality + i18n + routes + integration
pnpm lint:routes                       # API route consistency (client paths vs backend controllers)
pnpm lint:integration                  # Cross-layer integration (16 rules: enums, routes, AI, security)
pnpm lint:integration --domain=ai      # Integration check by domain (types|routes|ai|backend)
pnpm lint:integration --only=enum-consistency  # Integration check single rule
pnpm prepush                           # Typecheck + tests (same as pre-push hook)
pnpm check                             # lint:all + test (full local CI equivalent)
pnpm audit --audit-level=high --registry=https://registry.npmjs.org  # Dependency CVE scan
pnpm lint:dead-code                    # Knip dead code detection (unused files, exports, deps)
pnpm --filter web lint:quality         # Frontend quality (8 rules)
pnpm --filter api lint:quality         # Backend quality (7 rules)
pnpm --filter web lint:i18n            # i18n checks
pnpm test:e2e                          # E2E tests (requires Docker PG + Redis running)
npx tsx scripts/verify-gate.ts         # Per-commit verification (auto-detects affected apps)
npx tsx scripts/verify-gate.ts --staged # Same but only staged files
npx tsx scripts/check-migration-safety.ts          # Check all migrations for dangerous SQL
npx tsx scripts/check-migration-safety.ts --new-only # Only check uncommitted migrations
```

Exemption lists in each script for known-safe patterns.

## Admin Panel

### Architecture

- 20 active pages under `apps/web/src/app/[locale]/(main)/admin/`
- Dashboard uses **recharts** for AreaChart visualizations + health indicator
- Large pages split into `_components/` with self-contained `useQuery` per section
- i18n: `admin.*` keys in `apps/web/src/messages/{en,zh}.json`
- Backend: `AdminController` (`admin/`) + `AgentAdminController` (`admin/ai-agent/`)
- **Note**: `admin/ai-agent/_components/` is a shared component directory imported by `ai-operations/` — do NOT delete it
- **Note**: `admin/analytics/_components/` is a shared component directory imported by `ai-operations/` — do NOT delete it

### Pages

**Overview**: Dashboard (recharts AreaChart, health, recent activity)
**Users**: Users (search, role, ban, CSV export), User Detail (`users/[id]` — AI usage, rate limits), Verifications (4 tabs)
**Academic**: Data Review (6 tabs), Schools (3 tabs: search/quality/data-sync), High Schools (5 tabs), Calendar (2 tabs: Deadlines/Events), Calibrations (3 tabs), Essays (3 tabs), Activity Templates, Points
**Management**: Team (4 tabs), Moderation (5 tabs: Forum/Chat/Reviews/AI Moderation/Reports), Payments, Audit Logs (2 tabs: Admin/AI Agent)
**AI System**: AI Operations (5 tabs: Overview/Config/Performance/Reliability/Engagement), Memory (6 sections)
**System**: Settings, Feature Flags (CRUD + cache invalidation)

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
6. `[AUTO]` API routes use shared constants (`packages/shared/src/constants/api-routes.ts`)
7. `[MANUAL]` Sensitive endpoints have `@Roles(Role.ADMIN)`
8. `[MANUAL]` DTO fields have `@ApiProperty()` for Swagger

### Frontend PR

1. `[AUTO]` Tailwind classes are static (no `${var}` interpolation)
2. `[AUTO]` Hardcoded colors have `dark:` variant
3. `[AUTO]` New page has sibling `loading.tsx`
4. `[AUTO]` No `console.log` in production code
5. `[AUTO]` `Tooltip` must be wrapped in `TooltipProvider`
6. `[AUTO]` Accessibility: images have alt, elements focusable
7. `[MANUAL]` Icon buttons have `aria-label`
8. `[MANUAL]` Uses `PageHeader` + `PageContainer` pattern
9. `[MANUAL]` No hardcoded user-facing strings (use i18n)

### Run All Checks

```bash
pnpm lint:all    # ESLint + frontend quality + backend quality + i18n
```

## Architecture Governance (Automated Enforcement)

Multi-layer governance system for the AI Agent module. See ADR 0010-0015 for design decisions.

### Governance CLI

```bash
npx tsx scripts/governance/index.ts --all              # Run all 5 rules
npx tsx scripts/governance/index.ts --all --json       # JSON output (for CI/Jest)
npx tsx scripts/governance/index.ts --rules=optional-security,config-consistency
npx tsx scripts/governance/index.ts --verify-project   # Verify ts-morph project setup
pnpm lint:integration --domain=governance              # Via check-integration.ts
```

### Rules

| Rule | ID                     | Severity  | What it catches                                        |
| ---- | ---------------------- | --------- | ------------------------------------------------------ |
| G1   | `optional-security`    | **error** | `@Optional()` on PromptGuard/ContentModeration/Audit   |
| G2   | `nl-endpoint-coverage` | **error** | NL endpoint missing `AgentSecurityMiddleware` coverage |
| G3   | `config-consistency`   | **error** | Direct `AGENT_CONFIGS[...]` read outside validator     |
| G4   | `user-data-isolation`  | warning   | Prisma query missing `userId` filter in ai-agent code  |
| G5   | `dead-provider`        | warning   | Unused provider in `ai-agent.module.ts`                |

### Adding New NL Endpoints

When adding a new endpoint that accepts user-generated natural language:

1. Add route to `AgentSecurityMiddleware.forRoutes()` in `ai-agent.module.ts`
2. Add entry to `scripts/governance/nl-endpoints.json`
3. Run `npx tsx scripts/governance/index.ts --rule=nl-endpoint-coverage` to verify

### Runtime Validation

`ArchitectureValidatorService` runs on startup (`OnModuleInit`):

- **production/staging**: Missing security services → startup fails
- **development/test**: Missing security services → warn only
- Health endpoint `/health/detailed` reports `aiSecurity` status + `embeddingConsistency`
- `/health/ready` returns 503 when `aiSecurity === 'degraded'` in production/staging

### Coverage Matrix

| Gap               | Static (G1-G5) | Runtime          | Jest                 | ADR  |
| ----------------- | -------------- | ---------------- | -------------------- | ---- |
| Security coverage | G1, G2 (error) | Startup + Health | architecture.spec    | 0010 |
| @Optional abuse   | G1 (error)     | Startup          | architecture.spec    | 0011 |
| Config drift      | G3 (error)     | Startup          | architecture.spec    | 0010 |
| Observability     | —              | Health degraded  | aiSecurity assertion | 0010 |
| Multi-tenant      | G4 (warning)   | —                | —                    | 0010 |
| Dead code         | G5 (warning)   | —                | —                    | 0015 |

## File Index

| Category     | File                                                        | Purpose                                               |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Entry**    | `api/src/app.module.ts`                                     | Module imports, guard/interceptor/filter registration |
| **Auth**     | `api/src/modules/auth/auth.service.ts`                      | JWT, refresh rotation, brute force                    |
|              | `api/src/common/guards/jwt-auth.guard.ts`                   | Global JWT guard (`@Public()` to skip)                |
|              | `api/src/common/guards/roles.guard.ts`                      | Role-based access control                             |
| **Pipeline** | `api/src/tracing.ts`                                        | OTel SDK init (first import in main.ts)               |
|              | `api/src/common/interceptors/transform.interceptor.ts`      | Response envelope wrapping                            |
|              | `api/src/common/filters/http-exception.filter.ts`           | Global error handling                                 |
|              | `api/src/common/feature-flags/`                             | Feature flag module, service, guard, decorator        |
| **AI**       | `api/src/modules/ai-agent/core/llm.service.ts`              | Unified LLM service (chatSimple + call + callStream)  |
|              | `api/src/modules/ai-agent/core/orchestrator.service.ts`     | Multi-agent orchestrator                              |
|              | `api/src/modules/ai-agent/config/agents.config.ts`          | Agent definitions                                     |
|              | `api/src/modules/ai-agent/config/tools.config.ts`           | Tool definitions                                      |
|              | `api/src/modules/ai-agent/tools/helpers/llm-json.helper.ts` | JSON extraction helper                                |
| **DB**       | `api/prisma/schema.prisma`                                  | Database schema (~2460 lines)                         |
|              | `api/src/common/config/env.validation.ts`                   | Zod env var validation                                |
| **Frontend** | `web/src/components/providers/index.tsx`                    | Provider chain + AuthInitializer                      |
|              | `web/src/lib/api/client.ts`                                 | API client (auth, retry, unwrap)                      |
|              | `web/src/proxy.ts`                                          | Route protection + i18n                               |
|              | `web/src/stores/auth.ts`                                    | Auth state (Zustand)                                  |
|              | `web/src/lib/constants.ts`                                  | AI timeouts, cache times                              |
| **Shared**   | `packages/shared/src/types/index.ts`                        | Shared TypeScript types                               |
