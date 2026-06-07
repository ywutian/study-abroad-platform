# Web (Next.js 16 Frontend)

## Quick Reference

| Command                               | Purpose                            |
| ------------------------------------- | ---------------------------------- |
| `pnpm web`                            | Start dev server (port 4100)       |
| `pnpm --filter web lint:quality`      | Frontend quality checks (15 rules) |
| `pnpm --filter web lint:i18n`         | i18n consistency checks            |
| `pnpm --filter web exec tsc --noEmit` | TypeScript check                   |

## Route Structure (25 main routes)

`apps/web/src/app/[locale]/(main)/`: about, admin, ai, assessment, cases, chat, dashboard, essays, followers, forum, hall, help, notifications, prediction, privacy, profile, ranking, referral, resume, schools, settings, teams, terms, timeline, uncommon-app, vault

## 26 Feature Component Directories

`apps/web/src/components/features/`: admin, agent-chat (21 files), chat, essay-ai, essay-gallery, export, feedback, followers, forum, hall (17 files), help, landing, notifications, onboarding, peer-review, points, prediction (30 files), profile, recommendation, report, resume, schools (14 files), search, submit-case, teams, verification

Note: dashboard page-local components live in `apps/web/src/app/[locale]/(main)/dashboard/_components/` (not the shared `features/` tree). The old shared `features/dashboard/` was removed in PR #173 alongside the dashboard rebuild — see PRs #169-#175.

Key features have BRIEF.md files with purpose, components, and patterns.

## Shared Types

All shared AI types in `packages/shared/src/types/index.ts`: `AgentType`, `StreamEvent`, `ActionButton`, `Message`, `ToolCall`, `PredictionResult`, `RecommendationResult`, `AIAnalysisResult`. Frontend-only UI types stay local.

## PageContainer Variants

`PageContainer` (in `components/layout/page-container.tsx`) is the canonical page wrapper. Pick the variant that matches the page's role — don't override `max-w-*` via className (it depends on tw-merge priority and is semantically backwards; the `no-missing-min-w-in-grid-container` quality check covers the most common downstream bug).

| Variant          | maxWidth                | Use for                                                                                                                                                                                 |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing`      | `wide` (1280)           | Landing / about / marketing pages                                                                                                                                                       |
| `entry`          | `medium` (1024)         | Auth / signup / single-form pages                                                                                                                                                       |
| `tool` (default) | `wide`                  | Standard tool pages with normal content density                                                                                                                                         |
| `ai`             | `wide`                  | AI features with dense outputs                                                                                                                                                          |
| `community`      | `wide`                  | Forum / hall / posts                                                                                                                                                                    |
| `admin`          | `fluid` (1600)          | Admin tables / dashboards                                                                                                                                                               |
| `workbench`      | `workbench-wide` (1760) | **Viewport-locked three-column tool surfaces** (e.g. `/chat`). Encodes `min-w-0 flex flex-col lg:h-[calc(100dvh-var(--app-header-h,6.5rem))]` so the page doesn't have to. See PR #218. |

`--app-header-h` is defined on `(main)/layout.tsx` (default `6.5rem` = header + main top padding + buffer). Update there if the Header height changes — never hardcode in leaf pages.

## Dev Tooling

- `<OverflowDetector />` (in `components/dev/overflow-detector.tsx`, mounted via Providers): in `NODE_ENV === 'development'`, walks every element and warns when `scrollWidth > clientWidth`. Outlines the culprit in red and logs a clickable DevTools reference. Production: renders nothing. Mark intentional horizontal-overflow nodes with `data-allow-overflow-x` to opt out.
- `<main overflow-x-clip>` in `(main)/layout.tsx` is **production-only**. Dev mode lets overflow show so OverflowDetector can flag it. See PR #219.
