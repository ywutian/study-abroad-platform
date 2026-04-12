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
- `swipe.service.ts` — Tinder-style profile discovery with like/pass/super-like

## Data Model

Review (reviewerId, profileId, rating, content), UserList (title, schools), UserListVote, HallReaction, SwipeAction (userId, targetId, action). References: User, Profile, School.

## Dependencies

HallRankingService, HallReviewService, HallListService, HallVerifiedService, SwipeService | AI/LLM: Indirect (ranking analysis)

## Business Rules

- Public profiles browsable without auth; reviews require auth
- Verified rankings restricted to verified users' data
- Swipe actions: LIKE, PASS, SUPER_LIKE with leaderboard
- User lists support community voting
- `@ThrottleRelaxed()` on entire controller

## Gotchas

- HallService is a pure facade — all logic in sub-services
- Swipe DTOs are in separate `swipe-dto.ts` file
- Ranking analysis may call AI but through separate service path
