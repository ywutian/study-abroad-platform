# API (NestJS 11 Backend)

## Quick Reference

| Command                                         | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `pnpm api`                                      | Start dev server (port 4101)     |
| `pnpm --filter api db:generate`                 | Regenerate Prisma client         |
| `pnpm --filter api db:push`                     | Push schema (dev only)           |
| `pnpm --filter api db:migrate -- --name <name>` | Create migration                 |
| `pnpm --filter api db:seed`                     | Seed database                    |
| `pnpm --filter api db:studio`                   | Prisma Studio (port 5555)        |
| `pnpm --filter api lint:quality`                | Backend quality checks (7 rules) |
| `pnpm test`                                     | Run unit tests                   |
| `pnpm test:e2e`                                 | E2E tests (needs Docker)         |

## Schema

`prisma/schema.prisma` (~2460 lines, 28 enums, 50+ models). pgvector for AI memory embeddings.

**Schema Change Rules:**

- Every change MUST create a migration: `pnpm --filter api db:migrate -- --name <name>`
- **Never** `db:push` in production/staging
- New columns must be **nullable** or have a **default** (avoid downtime)
- CI/CD runs `prisma migrate deploy` automatically before service update

## 28 Modules Index

Each module has a `BRIEF.md` with purpose, key files, data model, and gotchas.

| Module         | Purpose                                                | AI/LLM   |
| -------------- | ------------------------------------------------------ | -------- |
| admin          | Admin ops, data pipeline, reviews, audit               | No       |
| ai             | Legacy wrapper: ProfileAiService, ResumeAiService      | Yes      |
| ai-agent       | Enterprise multi-agent LLM orchestrator (CORE)         | Yes      |
| assessment     | MBTI, Holland RIASEC assessments                       | Indirect |
| auth           | JWT, sessions, brute-force, MCP API keys               | No       |
| case           | Admission cases, batch import, quality scoring         | Indirect |
| chat           | User messaging, WebSocket, moderation                  | No       |
| essay          | Essay AI polish/review/brainstorm, prompts, gallery    | Yes      |
| forum          | Posts, comments, teaming, reporting                    | Indirect |
| hall           | Public profiles, ranking, reviews, swipe               | Indirect |
| health         | Liveness/readiness probes                              | Check    |
| notification   | Push notifications, event-driven dispatch              | No       |
| peer-review    | Mutual review requests and ratings                     | No       |
| points         | Gamification incentive system                          | No       |
| prediction     | ML-powered admission probability (18+ services)        | Yes      |
| profile        | User profile, education, scores, activities, awards    | Indirect |
| ranking        | Custom school ranking by user weights                  | No       |
| recommendation | AI school recommendations with probability             | Yes      |
| resume         | Resume/CV management, sections, snapshots              | Indirect |
| school         | College data, scraping, calibration, community ratings | No       |
| school-list    | Target school list, tier categorization                | No       |
| settings       | Global config (40+ keys), @Global()                    | No       |
| subscription   | Plans (free/pro/premium), payments                     | No       |
| team           | Team recruitment, swipe deck, matching                 | No       |
| timeline       | Deadline tracking, personal events, reminders          | No       |
| user           | Account management, dashboard aggregation              | No       |
| vault          | Encrypted document storage (AES-256)                   | No       |
| verification   | Identity/badge verification, document upload           | No       |

## Infrastructure (@Global())

`apps/api/src/common/`: prisma, redis, logger, email, storage, sentry, feature-flags, authorization, audit-log.
