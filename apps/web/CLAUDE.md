# Web (Next.js 16 Frontend)

## Quick Reference

| Command                               | Purpose                           |
| ------------------------------------- | --------------------------------- |
| `pnpm web`                            | Start dev server (port 4100)      |
| `pnpm --filter web lint:quality`      | Frontend quality checks (8 rules) |
| `pnpm --filter web lint:i18n`         | i18n consistency checks           |
| `pnpm --filter web exec tsc --noEmit` | TypeScript check                  |

## Route Structure (25 main routes)

`apps/web/src/app/[locale]/(main)/`: about, admin, ai, assessment, cases, chat, dashboard, essays, followers, forum, hall, help, notifications, prediction, privacy, profile, ranking, referral, resume, schools, settings, teams, terms, timeline, uncommon-app, vault

## 27 Feature Component Directories

`apps/web/src/components/features/`: admin, agent-chat (17 files), chat, dashboard, essay-ai, essay-gallery, export, feedback, followers, forum, hall (16 files), help, landing, notifications, onboarding, peer-review, points, prediction (20 files), profile, recommendation, report, resume, schools (10 files), search, submit-case, teams, verification

Key features have BRIEF.md files with purpose, components, and patterns.

## Shared Types

All shared AI types in `packages/shared/src/types/index.ts`: `AgentType`, `StreamEvent`, `ActionButton`, `Message`, `ToolCall`, `PredictionResult`, `RecommendationResult`, `AIAnalysisResult`. Frontend-only UI types stay local.
