# Module: hall

## Purpose

Public profile showcase: community rankings, reviews, user-curated school lists, verified applicant rankings, and swipe-based profile discovery.

## Key Files

- `hall.controller.ts` — Public profiles, rankings, reviews, lists, verified rankings, reactions, swipe
- `hall.service.ts` — Thin facade delegating to 4 sub-services + SwipeService
- `hall-ranking.service.ts` — Batch ranking by school, profile ranking, target school ranking
- `hall-review.service.ts` — User reviews of public profiles
- `hall-list.service.ts` — User-curated lists (create, vote, manage)
- `hall-verified.service.ts` — Verified applicant rankings with analysis
- `swipe.service.ts` — Case study loop: browse real cases, guess the outcome, debrief

## Data Model

Review (reviewerId, profileUserId, academicScore/testScore/activityScore/awardScore/overallScore, comments, tags, status, helpfulCount), ReviewReaction (reviewId, userId, type), UserList (title, items[]), UserListVote, CaseSwipe (userId, caseId, prediction), SwipeStats (per-user `totalSwipes`/`correctCount` only — Plan C C3 de-gamified; streak/badge/dailyChallenge columns retained in schema but no longer written, dropped in C6). References: User, Profile, School, AdmissionCase.

## Dependencies

HallRankingService, HallReviewService, HallListService, HallVerifiedService, SwipeService | AI/LLM: Indirect (ranking analysis)

## Business Rules

- Public profiles browsable without auth; reviews require auth
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
