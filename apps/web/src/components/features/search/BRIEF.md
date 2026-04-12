# Feature: Search

## Purpose

Global search dialog (Cmd+K) for finding schools, cases, articles, and pages.

## Key Files

- `global-search.tsx` — Command-palette dialog with debounced search, result categories, and recent searches

## Patterns

- Result types: `school`, `case`, `article`, `ai`, `page`
- Uses `useDebounce` hook for search input
- Keyboard shortcut (Cmd+K / Ctrl+K) opens the dialog
