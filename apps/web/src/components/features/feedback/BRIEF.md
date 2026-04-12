# Feature: Feedback

## Purpose

Floating feedback widget for users to submit bugs, suggestions, and praise.

## Key Files

- `feedback-widget.tsx` — Popover-based widget with category selection (bug/idea/help/praise), text input, screenshot option

## Patterns

- Uses `useHydrated()` to avoid SSR mismatch (renders only client-side)
- Rendered globally via provider chain — appears on all authenticated pages
