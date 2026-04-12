# Feature: Teams (Recruitment)

## Purpose

School-based team recruitment with swipe-to-match interface for finding study-abroad peers.

## Components

- TeamCard — displays team info (school, tags, member count, join policy)
- RecruitmentSwipeCard — swipeable candidate card for team recruitment
- RecruitmentSwipeDeck — manages the recruitment swipe stack

## Data Flow

- API: `/teams`, `/teams/:id/join`, `/teams/:id/members`
- TeamCardData includes school association, visibility, join policy, tags

## Patterns

- `team-recruitment-utils.ts` with unit tests for matching logic
- Reuses swipe gesture patterns from hall feature
- i18n via `useTranslations` with team-specific keys
