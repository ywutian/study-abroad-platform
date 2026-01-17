// 动画相关
export * from './use-scroll-animation';
export * from './use-theme-transition';

// 交互相关
export * from './use-keyboard-shortcuts';
export * from './use-network-status';
export * from './use-unsaved-changes';

// 认证
export { useAuth } from './use-auth';

// 通用
export { useDebounce } from './useDebounce';
export { useRefreshOnFocus } from './useRefreshOnFocus';

// Hall 模块
export {
  hallKeys,
  useSwipeCases,
  useSwipeStats,
  useLeaderboard,
  useSwipeMutation,
  useTargetRanking,
  useSchoolRanking,
  useAiAnalysis,
  useSubmitReview,
  usePublicLists,
} from './use-hall-api';

// Hydration 安全
export {
  useHydrated,
  useHydrationContext,
  useClientValue,
  useClientCallback,
  HydrationProvider,
  isBrowser,
  isServer,
} from './use-hydration';
