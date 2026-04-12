# Feature: Hall (Case Gallery)

## Purpose

Tinder-style swipe interface for reviewing real admission cases — gamified learning with badges, leaderboards, and challenges.

## Components

- SwipeCard — draggable case card with applicant stats (framer-motion gestures)
- SwipeStack — manages card deck with accept/reject swipe logic
- SwipeResultOverlay — shows result after swipe decision
- SwipeReviewMode — review previously swiped cases
- TinderTab — main swipe interface tab
- ReviewTab — review past decisions
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
- Tab-based page split (TinderTab, ReviewTab, RankingTab, ListsTab)
- Gamification: badges, streaks, daily challenges, leaderboard
