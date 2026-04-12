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
