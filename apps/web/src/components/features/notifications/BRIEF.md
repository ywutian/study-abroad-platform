# Feature: Notifications

## Purpose

Notification center popover with tabbed categories, mark-read, and delete actions.

## Key Files

- `notification-center.tsx` — Bell icon popover with tabs (all/social/system/awards), bulk mark-read, individual delete

## Patterns

- Uses `useQuery` for polling notifications, `useMutation` for mark-read/delete
- Icon types mapped to lucide icons (UserPlus, Heart, Award, etc.) based on notification category
- Locale-aware relative timestamps via `date-fns`
