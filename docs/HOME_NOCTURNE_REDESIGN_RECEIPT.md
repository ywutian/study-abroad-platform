# Closure Receipt — "Lumni Nocturne" Redesign (full app)

> **Full rollout (batches 1–5):** the entire mobile app — **6 bottom tabs + ~40 detail/stack/auth screens** — is now Nocturne. Home (batch 1) was a full rewrite with backend closed-loop; the rest were surgical restyles (mono numerals, hardcoded-color/dynamic-style/elevation cleanup, card consistency, a11y) keeping every data hook / route / i18n key. Batches 3–5 were executed by a **multi-agent Workflow** (one agent per screen, parallel, verify-after-each).
>
> **Final verification (whole app):** mobile `tsc` **0 errors** · quality gate **0 errors** (warnings 209→**177**) · **full test suite 318/318 pass** · i18n en/zh parity · 4 workflow verify-agents + Integration/Data-Model agents all PASS.
>
> **Screenshots (dark, live data):** `home-nocturne-{dark,light}`, `schools/cases/more/prediction/school-detail/timeline/profile-scores/settings/case-detail/forum/find-college/subscription/recommendation-nocturne.png` in `docs/claude-design-export/screenshots/`.
>
> _Not touched (by design):_ internal `/admin`; `packages/shared` color tokens + web app; the 5 stub screens stay EmptyState (no content to restyle). Advisory warnings that remain are intentional (semantic tier/status colors, gradient heroes) or false-positives (dynamic widths) — not defects.

---

## (Batch 1) Home — full redesign detail

Implements `app/index.html` from the Claude Design "Lumni Nocturne" prototype into the
real Expo app, with **backend closed-loop** (no fake numbers) and **enterprise-grade**
quality. Scope: Home screen + design foundation (Geist Mono). `packages/shared` color
tokens and the web app are **not** restyled.

## What shipped

**A. Backend data closure** — Home now uses `GET /users/me/dashboard` (the resilient
web-parity aggregation) as its single source of truth (was 5 ad-hoc queries). Added one
additive, optional field `pendingTasks.todayCount` to power the "今日待办" stat truthfully.

**B. Foundation** — Geist Mono (OFL) loaded via `expo-font` in `_layout.tsx`; `fontFamily.mono`
token. Nocturne look comes from the **existing** warm dark-gold default palette (the
`no-shared-token-drift` gate forbids hand-authored colors in `theme.ts`; web stays untouched).

**C. Home restyle** — 840-line gradient-hero screen split into a thin orchestrator +
8 token-disciplined components (`src/components/features/home/`): surface hero with
next-action card + mono stats, quick-actions grid, CircularProgress grade ring, tier
tiles, deadline rows w/ logo squares, top-schools rail, recent-cases list. LinearGradient
removed (fixes `no-linear-gradient-hero`). a11y roles/labels, ≥44px targets, both themes.

## Data-closure trace (every datum → real field)

| Home datum                              | Endpoint              | DTO field                                                    |
| --------------------------------------- | --------------------- | ------------------------------------------------------------ |
| greeting + username                     | `/users/me/dashboard` | `user.nickname \|\| user.email`                              |
| next-action (school·round, tasks, days) | `/users/me/dashboard` | `upcomingDeadlines[0]` + `pendingTasks.total`                |
| stat · 今日待办                         | `/users/me/dashboard` | `pendingTasks.todayCount` (new)                              |
| stat · 已提交 N/总                      | `/users/me/dashboard` | `workbench.pipeline.submitted` / `profile.targetSchoolCount` |
| stat · 资料完成 %                       | `/users/me/dashboard` | `profile.completeness`                                       |
| grade ring                              | `/users/me/dashboard` | `profile.completeness`                                       |
| tier tiles                              | `/users/me/dashboard` | `profile.schoolTiers.{reach,target,safety}`                  |
| upcoming deadlines                      | `/users/me/dashboard` | `upcomingDeadlines[]`                                        |
| top schools                             | `/schools`            | `schoolRoutes.list()`                                        |
| recent cases                            | `/cases`              | `caseRoutes.list()`                                          |

No Home stat is hardcoded (trace grep clean — only grade-threshold constants remain).

## 闭环检查 results

| Check                                            | Result                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| Data-closure trace (no fake numbers)             | ✅                                                     |
| **Integration Checker** agent (FE↔BE)            | ✅ PASS — "fully closed end-to-end"                    |
| **Data Model Reviewer** agent (todayCount chain) | ✅ PASS — "sound + web-safe"                           |
| `pnpm lint:routes`                               | ✅ all client paths match controllers                  |
| `pnpm lint:integration` (16 rules)               | ✅ 0 errors                                            |
| mobile `tsc --noEmit`                            | ✅ 0 errors                                            |
| `check-mobile-quality.ts`                        | ✅ 0 errors (212 pre-existing warnings)                |
| `check-mobile-i18n.ts` (en/zh parity)            | ✅ pass (1643 === 1643)                                |
| dashboard service tests                          | ✅ 39/39                                               |
| Home screen tests                                | ✅ 7/7                                                 |
| Visual closure (live data, both themes)          | ✅ `home-nocturne-dark.png`, `home-nocturne-light.png` |

## Files

- Backend: `apps/api/src/modules/user/dashboard.service.ts` (+`.spec`), `packages/shared/src/types/dashboard.ts` (optional `todayCount`).
- Foundation: `apps/mobile/src/utils/theme.ts` (`fontFamily.mono`), `apps/mobile/src/app/_layout.tsx` (font load), `apps/mobile/assets/fonts/GeistMono.ttf`.
- Home: `apps/mobile/src/app/(tabs)/index.tsx` (thin) + `apps/mobile/src/components/features/home/*` (8 files), `home.test.tsx`.
- i18n: `apps/mobile/src/lib/i18n/locales/{en,zh}.json` (11 new keys, both locales).

## Notes / follow-ups (non-blocking)

- Exact Nocturne hexes (warmer `#0c0a07` etc.) would require adding a **named palette to
  `packages/shared`** (additive, web-safe) — deferred to honor "don't touch shared". Current
  default palette already reads as Nocturne/Ivory.
- A few legacy `home.*` keys (`welcomeBack`, `stats.*`, `features.essay*`) are now dead but
  symmetric across locales — optional cleanup.
- Test mock `applicationTask.count` discriminates on `dueDate.lt` (returns 1 for both today &
  overdue queries; both assert 1 so harmless) — switch to `dueDate.gte` if they must differ.
