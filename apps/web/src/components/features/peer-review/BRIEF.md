# Feature: Peer Review

## Purpose

Peer-to-peer review system: star ratings, review cards, and review submission dialog.

## Key Files

- `RatingDisplay.tsx` — Read-only star rating display (half-star support) with optional count
- `RatingInput.tsx` — Interactive star rating input with hover preview
- `ReviewCard.tsx` — Single review card showing reviewer info, rating, and text
- `ReviewDialog.tsx` — Modal for submitting a multi-criteria review with text and anonymous toggle

## Patterns

- `ReviewDialog` uses `RatingInput` for each criteria dimension
- `ReviewCard` uses `RatingDisplay` — composable rating primitives
- API calls via `apiClient` with react-query mutations
