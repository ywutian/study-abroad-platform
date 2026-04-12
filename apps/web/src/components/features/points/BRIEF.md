# Feature: Points

## Purpose

Gamification points system UI: balance overview, transaction history, and earning rules.

## Key Files

- `PointsOverview.tsx` — Current balance, level progress, and trend stats via `useQuery`
- `PointsHistory.tsx` — Scrollable transaction history with category badges and relative timestamps
- `PointsRulesCard.tsx` — Tabbed display of point-earning and spending rules

## Patterns

- All three components self-fetch via `useQuery` + `apiClient`
- Uses `date-fns` locale switching for `zhCN`/`enUS` timestamps
