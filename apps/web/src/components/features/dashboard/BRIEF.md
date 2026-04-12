# Feature: Dashboard

## Purpose

Dashboard widgets displaying user stats, upcoming deadlines, and recent activity.

## Key Files

- `DashboardStats.tsx` — Profile completeness, school/essay counts, followers, points overview cards
- `DeadlineReminder.tsx` — Scrollable list of upcoming application deadlines with days-left badges
- `RecentActivity.tsx` — Activity feed with date-fns locale-aware relative timestamps

## Patterns

- All components accept data via props (no internal fetching) — parent page owns queries
- Uses `date-fns` with `zhCN`/`enUS` locale switching for time formatting
- Motion-animated cards with framer-motion
