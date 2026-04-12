# Feature: Followers

## Purpose

Social follow system components: recommended users and profile preview dialogs.

## Key Files

- `RecommendedUsers.tsx` — Horizontal scroll card list of suggested users to follow, with follow/unfollow mutations
- `UserProfilePreview.tsx` — Dialog showing user profile summary with follow button and stats

## Patterns

- Uses `chatRoutes` from `@study-abroad/shared` for API paths
- Both components use `useQuery`/`useMutation` with react-query for data fetching
