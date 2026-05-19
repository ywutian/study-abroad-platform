# Module: hall

## Purpose

Public profile showcase: community rankings, user-curated school lists, verified applicant rankings, and swipe-based profile discovery.

> Hall §7 Decision B: the peer-review subsystem (`Review`/`ReviewReaction`,
> the reviewer L1→L2 qualification quiz, the AI review coach) was retired —
> all review files, routes, and the `Review` table were deleted.

## Key Files

- `hall.controller.ts` — Rankings, lists, verified rankings, swipe, BFF overview
- `hall.service.ts` — Thin facade delegating to 3 sub-services + SwipeService
- `hall-ranking.service.ts` — Batch ranking by school, profile ranking, target school ranking
- `hall-list.service.ts` — User-curated lists (create, vote, manage)
- `hall-verified.service.ts` — Verified applicant rankings with analysis
- `hall-verified-dashboard.service.ts` — China admit dashboard (trend/difficulty/ED-RD)
- `hall-overview.service.ts` — BFF aggregation for the Points Center
- `swipe.service.ts` — Case study loop: browse real cases, guess the outcome, debrief

## Data Model

UserList (title, items[]), UserListVote, CaseSwipe (userId, caseId, prediction), SwipeStats (per-user `totalSwipes`/`correctCount` only — Plan C C3 de-gamified; Hall §7 C6 dropped the streak/bestStreak/badge/dailyChallenge columns). References: User, Profile, School, AdmissionCase.

## Dependencies

HallRankingService, HallListService, HallVerifiedService, HallVerifiedDashboardService, HallOverviewService, SwipeService | AI/LLM: Indirect (ranking analysis)

## Business Rules

- Public lists browsable without auth
- Verified rankings restricted to verified users' data
- Swipe loop is de-gamified (Plan C C3): no points, streak, badge, daily
  challenge or leaderboard. `getStats` returns only private calibration
  accuracy (total/correct/accuracy), visible to the user alone.
- User lists support community voting
- `@ThrottleRelaxed()` on entire controller

## Gotchas

- HallService is a pure facade — all logic in sub-services
- Swipe DTOs are in separate `swipe-dto/` directory
- Ranking analysis may call AI but through separate service path
