---
description: "Mobile app development rules for Expo/React Native"
globs: ["apps/mobile/**"]
---

# Mobile Rules

## Stack

Expo SDK 54, React 19.1, React Native 0.81.5, expo-router 6, Reanimated 4, React Navigation v7.

## Key Patterns

- **Theme**: `useColors()` from `@/utils/theme`, `spacing`, `fontSize`, `fontWeight`, `borderRadius`
- **i18n**: `react-i18next`, locales at `src/lib/i18n/locales/{en,zh}.json`
- **UI**: `@/components/ui` barrel export
- **API**: `apiClient` from `@/lib/api/client` with `get/post/put/delete`
- **Data**: `@tanstack/react-query` with `useQuery/useMutation`
- **Offline**: `PersistQueryClientProvider` with AsyncStorage persister in `_layout.tsx`

## Library-Specific Notes

- FlashList v2 (`@shopify/flash-list@2.x`): no `estimatedItemSize` prop, ref type is `FlashListRef<T>`
- Reanimated 4: babel plugin `react-native-worklets/plugin`
- React Navigation v7: `BottomTabBarProps` includes `insets`
- expo-notifications SDK 54: `shouldShowAlert` -> `shouldShowBanner` + `shouldShowList`

## Shared Package

- Modify `packages/shared` -> must `pnpm --filter @study-abroad/shared build` before mobile verification
- `package.json exports`: `types` + `import` -> `.ts` source; `default` -> `dist/*.js`
- `metro.config.js` must have `unstable_enablePackageExports = true`
- Test mocks must provide route helpers when mocking `@study-abroad/shared`

## Mobile is Required Consumer

When shared `application-analysis` contract changes, mobile surfaces (`/profile`, `/profile/analysis`, `/prediction`) must be updated.
