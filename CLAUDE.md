# Study Abroad Platform — Development Guide

## Architecture

Turbo monorepo with pnpm workspaces:

- `apps/api` — NestJS 11 backend (PostgreSQL + Prisma, Redis) — 28 domain modules
- `apps/web` — Next.js 16 frontend (React 19, Tailwind, next-intl)
- `apps/mobile` — Expo 54 (React Native)
- `packages/shared` — Shared types, constants, scoring algorithms

Response envelope: `{ success, data, meta }` (TransformInterceptor) — **never manually build**. Frontend `apiClient` unwraps automatically.

Role hierarchy: `ADMIN` > `VERIFIED` > `USER`. ADMIN overrides all checks.

## Commands

```bash
./dev.sh                  # One-command: Docker + Prisma + API + Web
./dev.sh --fresh          # Full: migrate + seed + start
pnpm dev                  # Turbo parallel dev (all apps)
pnpm api / pnpm web       # Individual app dev
pnpm docker:up / down     # PostgreSQL 16 (pgvector) + Redis 7
pnpm build                # Production build
pnpm lint:all             # ESLint + quality + i18n + routes + integration
pnpm test                 # Unit tests (API: Jest, Web: Vitest)
pnpm test:e2e             # E2E tests (requires Docker)
pnpm prepush              # Typecheck + tests (same as pre-push hook)
pnpm check                # Full local CI equivalent
```

URLs: Web :4100 | API :4101 | Swagger :4101/api/docs | Prisma Studio :5555

## Database Rules

- Schema: `apps/api/prisma/schema.prisma` (~2460 lines, 28 enums, 50+ models, pgvector)
- Every schema change **MUST** create a migration: `pnpm --filter api db:migrate -- --name <name>`
- **Never** `db:push` in production/staging
- New columns must be **nullable** or have **default** (avoid downtime)
- After schema change: `pnpm --filter api db:generate` before typecheck
- CI/CD runs `prisma migrate deploy` automatically

## Non-Negotiable Patterns

- **JSON from LLM**: Always `extractJsonFromLlm()` from `common/utils/llm-json.util` — never regex
- **Shared types**: `packages/shared/src/types/index.ts` — `AgentType`, `StreamEvent`, `PredictionResult`, etc.
- **Prisma selects**: Extract to `*.constants.ts` with mapper functions — never inline duplicated selects
- **DTO fields**: Use Prisma enum types (`import { MyEnum } from '@prisma/client'`), not `string`
- **nodenext**: Cross-module references must use static `import`, not `await import()`
- **shared pkg changes**: Must `pnpm --filter @study-abroad/shared build` before verification

## Agent Workflow (MUST FOLLOW)

13 specialized Agents with Step 0 relevance filtering. When in doubt, launch more — N/A early-exit costs ~10s.

| #   | Agent                | File                                     | Role                          |
| --- | -------------------- | ---------------------------------------- | ----------------------------- |
| 1   | Study Abroad Expert  | `.claude/agents/study-abroad-expert.md`  | Business logic validation     |
| 2   | Applicant Simulator  | `.claude/agents/applicant-simulator.md`  | Student/parent UX review      |
| 3   | Design Reviewer      | `.claude/agents/design-reviewer.md`      | UI/UX, dark mode, a11y        |
| 4   | Architect            | `.claude/agents/architect.md`            | System design, API, deps      |
| 5   | Integration Checker  | `.claude/agents/integration-checker.md`  | Frontend-backend closure      |
| 6   | Data Model Reviewer  | `.claude/agents/data-model-reviewer.md`  | Schema-DTO-type chain         |
| 7   | Security Reviewer    | `.claude/agents/security-reviewer.md`    | Auth, injection, OWASP        |
| 8   | AI Prompt Engineer   | `.claude/agents/ai-prompt-engineer.md`   | Prompt quality, hallucination |
| 9   | i18n Specialist      | `.claude/agents/i18n-specialist.md`      | Translation, key coverage     |
| 10  | Test Engineer        | `.claude/agents/test-engineer.md`        | Test coverage, edge cases     |
| 11  | Mobile Specialist    | `.claude/agents/mobile-specialist.md`    | Expo/RN compatibility         |
| 12  | Feedback Processor   | `.claude/agents/feedback-processor.md`   | Feedback triage, root cause   |
| 13  | User Journey Auditor | `.claude/agents/user-journey-auditor.md` | E2E journey completeness      |

### Phase 1: Plan Review (by change type)

| Change Type  | Launch Agents                                       | Add If Needed                            |
| ------------ | --------------------------------------------------- | ---------------------------------------- |
| Backend      | Architect, Data Model, Security, Test               | AI Prompt (if LLM)                       |
| Frontend     | Design, i18n, Applicant Sim, Test                   | —                                        |
| Mobile       | Mobile, i18n, Applicant Sim, Test                   | —                                        |
| AI Feature   | AI Prompt, Study Abroad, Security, Test             | —                                        |
| Full-Stack   | Architect, Data Model, Design, i18n, Security, Test | +Study Abroad/AI Prompt/Mobile as needed |
| DB Change    | Data Model, Architect, Security                     | —                                        |
| Large Change | **All 13 in parallel**                              | —                                        |

### Phase 2: Acceptance (MANDATORY)

1. **Integration Checker** — frontend-backend alignment, types, i18n, permissions
2. **Test Engineer** — run tests, fill gaps, verify pass
3. **User Journey Auditor** — feature completeness (when user-visible)

### Rules

- Parallel agents **MUST** run in parallel
- **Prisma Model changes**: grep all consumers, mark "needs update" or "N/A (reason)"
- **Nullable field frontend**: Never `|| 'SomeEnum'` as default — show "unknown/unset" state

### Cross-Cutting Rules

- Prisma field in frontend UI -> add **Design Reviewer**
- LLM output structure change -> add **Data Model Reviewer**
- API error code change -> add **Integration Checker**
- `packages/shared` type change -> add **Mobile Specialist** (if mobile uses it)
- Nullable field with frontend display -> add **Applicant Simulator**
- Prompt output for business decisions -> add **Study Abroad Expert**

## Feedback Processing

External feedback MUST follow 5 stages — never skip triage to code directly:

1. **Triage**: Classify as `CODE_BUG | DATA_ISSUE | UX_CONFUSION | NEW_FEATURE | INDUSTRY_SUGGESTION`
2. **Batch Plan**: ≤3 items/batch, launch relevant agents
3. **Implement**: Run `npx tsx scripts/verify-gate.ts --staged` before commit
4. **Verify**: Acceptance criteria = user-visible result, not "code changed"
5. **Release**: Pre-push gate pass, update feedback docs, mark verified

## Env Variables

Zod schema in `common/config/env.validation.ts`. Required in prod: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `FRONTEND_URL`, `VAULT_ENCRYPTION_KEY`.

## Lessons Learned

- Prisma schema change -> `db:generate` before typecheck
- DTO fields: use Prisma enums, not `string`
- nodenext: static `import` only, no `await import()`
- Test mocks: new Prisma model -> add model mock everywhere
- Zustand mock: `jest.fn((sel) => sel ? sel(state) : state)`
- Coverage: start low (3-5%), increase gradually
- CVE fixes: `pnpm.overrides` in root package.json
- E2E: sync route renames to `test/*.e2e-spec.ts`
- shared changes: build before mobile verification
- Metro: `unstable_enablePackageExports = true`

## Context Routing

修改代码前，**先读对应文档**：

| 代码路径匹配                                      | 必读文档                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| `modules/prediction/`                             | `docs/PREDICTION_SYSTEM.md` + 模块 `BRIEF.md`       |
| `modules/ai-agent/`                               | `.claude/memory/ai-system.md` + 模块 `BRIEF.md`     |
| `modules/auth/`, guards/                          | `.claude/rules/security.md` + `docs/adr/0010-*.md`  |
| `apps/web/src/app/*/admin/`                       | `apps/web/CLAUDE.md` Admin Panel 段                 |
| `prisma/schema.prisma`                            | `apps/api/CLAUDE.md` Schema Change Rules            |
| `.github/`, `.husky/`, `scripts/`                 | `.claude/rules/ci-cd.md`                            |
| `packages/shared/`                                | `packages/shared/CLAUDE.md`                         |
| `apps/mobile/`                                    | `apps/mobile/CLAUDE.md` + `.claude/rules/mobile.md` |
| 留学业务逻辑 (school, prediction, recommendation) | `docs/DATA_SOURCES.md`                              |
| 部署/运维                                         | `docs/DEPLOYMENT_STRATEGY.md` + `docs/RUNBOOK.md`   |

## Hooks (自动强制执行)

以下规则由 `.husky/` + `lint-staged` 自动执行，Claude 需知悉以避免触发失败：

| Hook                        | 触发                      | 效果                                             |
| --------------------------- | ------------------------- | ------------------------------------------------ |
| **pre-commit: lint**        | 提交 `.ts/.tsx`           | Prettier + ESLint 自动修复                       |
| **pre-commit: i18n**        | 修改 `apps/web/src/`      | 阻断：missing keys / wrong language / key 不一致 |
| **pre-commit: quality**     | 修改前端代码              | 阻断：动态 Tailwind、缺 dark:、缺 loading.tsx    |
| **pre-commit: api-quality** | 修改后端代码              | 阻断：inline @Body、缺 @ThrottleAI               |
| **pre-push: verify-gate**   | `git push`                | 阻断：typecheck + test + lint:routes + lint:i18n |
| **pre-push: migration**     | 修改 `prisma/migrations/` | 阻断：NOT NULL without DEFAULT、DROP TABLE       |
| **pre-push: audit**         | `git push`                | 警告：high-severity CVE                          |

## Documentation Governance (防膨胀)

| 规则                        | 门禁值              | 超限动作                                   |
| --------------------------- | ------------------- | ------------------------------------------ |
| 根 `CLAUDE.md` 行数         | ≤ 200 行            | 拆分到 `.claude/rules/` 或子目录 CLAUDE.md |
| `.claude/rules/*.md` 单文件 | ≤ 150 行            | 拆分为多个 rule 文件                       |
| 子目录 `CLAUDE.md`          | ≤ 80 行             | 精简或移到 BRIEF.md                        |
| CLAUDE.md vs docs/ 重复     | 0（>10 行视为重复） | 替换为链接引用                             |
| BRIEF.md 单文件             | ≤ 40 行             | 只保留"不知道会犯错"的内容                 |

## Rules Index

Detailed rules load automatically based on file path:

| Rule File                    | Activates When Editing                     |
| ---------------------------- | ------------------------------------------ |
| `.claude/rules/backend.md`   | `apps/api/**`                              |
| `.claude/rules/frontend.md`  | `apps/web/**`                              |
| `.claude/rules/mobile.md`    | `apps/mobile/**`                           |
| `.claude/rules/ai-system.md` | AI/prediction/essay/recommendation modules |
| `.claude/rules/security.md`  | auth/guards/vault code                     |
| `.claude/rules/testing.md`   | `*.spec.ts`, `*.test.ts` files             |
| `.claude/rules/ci-cd.md`     | `.github/**`, scripts, hooks               |

Subdirectory docs (lazy-loaded): `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `packages/shared/CLAUDE.md`
Module briefings: `apps/api/src/modules/*/BRIEF.md`, `apps/web/src/components/features/*/BRIEF.md`
