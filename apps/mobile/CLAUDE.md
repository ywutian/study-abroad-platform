# Mobile (Expo 54)

## Quick Reference

| Command                      | Purpose               |
| ---------------------------- | --------------------- |
| `pnpm --filter mobile start` | Start Expo dev server |
| `pnpm --filter mobile test`  | Run Jest tests        |
| `pnpm --filter mobile lint`  | ESLint                |

## Stack

Expo SDK 54, React 19.1, React Native 0.81.5, expo-router 6, Reanimated 4.

## Conventions

- Theme: `useColors()` from `@/utils/theme`
- i18n: `react-i18next`, locales at `src/lib/i18n/locales/{en,zh}.json`
- API: `apiClient` from `@/lib/api/client`
- Data: `@tanstack/react-query`
- Offline: `PersistQueryClientProvider` with AsyncStorage

## Required Consumer

Mobile must be updated when:

- `packages/shared` types change (build shared first)
- Application-analysis contract changes
- Surfaces: `/profile`, `/profile/analysis`, `/prediction`
