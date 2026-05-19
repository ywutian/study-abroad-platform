# Feature: Hall (Case Gallery)

## Purpose

Swipe interface for studying real admission cases — a learning loop: browse a
real case, guess the outcome, see the AI debrief. De-gamified (Plan C C3): no
badges, streaks, daily challenge or leaderboard.

## Components

- SwipeCard — draggable case card with applicant stats (framer-motion gestures)
- SwipeStack — manages card deck with accept/reject swipe logic
- SwipeResultOverlay — shows correct/wrong + the real outcome after a swipe
- TinderTab — main swipe interface tab + a private calibration-accuracy stat
- ReviewTab — re-export shim for `review/ReviewTab` (stable import path)
- review/ — qualitative peer-feedback experience (Plan C C2: numeric scoring
  removed): ReviewTab orchestrator + QualitativeReviewForm + review-shared
- RankingTab — thin orchestrator (data + state)
- ranking/ — RankingTab sub-components: SummaryStats, SchoolPicker, ResultsGrid
  (RankingCard), CompetitorDistribution, AiPanel + ranking-shared (POSITION_CONFIG)
- ListsTab — curated case lists
- VerifiedTab / ChallengeTab — verified cases and multi-school batch prediction

## Data Flow

- API: `/halls/swipe/batch`, `/halls/swipe/predict`, `/halls/swipe/stats`,
  `/halls/swipe/challenge`
- SwipeCaseData includes school info, GPA, test scores, activities, admission result

## Patterns

- Framer Motion for drag gestures and card animations
- Shared swipe physics: `lib/hooks/useSwipeGesture.ts` (x/y/rotate/opacity + drag-end classifier)
- Tab-based page split (TinderTab, ReviewTab, RankingTab, ListsTab)
- Review is single-track and qualitative-only: ReviewTab orchestrator → select
  profile → QualitativeReviewForm (written feedback, no scores) → one submit
- Calibration accuracy (total/correct/accuracy) is private — visible only to the
  user, never aggregated into a leaderboard
