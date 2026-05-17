# Feature: Hall (Case Gallery)

## Purpose

Tinder-style swipe interface for reviewing real admission cases — gamified learning with badges, leaderboards, and challenges.

## Components

- SwipeCard — draggable case card with applicant stats (framer-motion gestures)
- SwipeStack — manages card deck with accept/reject swipe logic
- SwipeResultOverlay — shows result after swipe decision
- TinderTab — main swipe interface tab
- ReviewTab — re-export shim for `review/ReviewTab` (stable import path)
- review/ — peer-review experience: ReviewTab orchestrator + ClassicReviewWizard
  (slider fallback) + SwipeReviewWizard (Tinder-style 4-step swipe) + review-shared
- RankingTab — leaderboard display
- ListsTab — curated case lists
- VerifiedTab / ChallengeTab — verified cases and daily challenges
- BadgeDisplay — achievement badges with progress tracking
- StatsPanel — swipe accuracy and streak stats
- DailyChallenge — daily prediction challenge prompt
- LeaderboardList — ranked user list
- ReviewModuleCard — module/topic selector for focused review

## Data Flow

- API: `/hall/cases`, `/hall/swipe`, `/hall/leaderboard`, `/hall/badges`
- SwipeCaseData includes school info, GPA, test scores, activities, admission result

## Patterns

- Framer Motion for drag gestures and card animations
- Shared swipe physics: `lib/hooks/useSwipeGesture.ts` (x/y/rotate/opacity + drag-end classifier)
- Tab-based page split (TinderTab, ReviewTab, RankingTab, ListsTab)
- Review is single-track: one ReviewTab orchestrator → choose swipe/classic wizard → one submit
- Gamification: badges, streaks, daily challenges, leaderboard
