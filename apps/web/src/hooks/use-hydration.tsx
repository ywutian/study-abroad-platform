/**
 * 企业级 Hydration 安全方案
 *
 * 解决 Next.js SSR 与客户端渲染不一致导致的 Hydration Mismatch 问题
 *
 * 使用场景：
 * 1. 动态生成 ID 的组件（Radix UI、Headless UI）
 * 2. 依赖浏览器 API 的组件（window、localStorage）
 * 3. 动态内容（时间戳、随机数）
 * 4. 第三方库注入的属性
 */

import { useSyncExternalStore, useCallback, createContext, useContext, ReactNode } from 'react';

// ============================================================================
// Core: useSyncExternalStore 方案（React 18 推荐）
// ============================================================================

/**
 * 服务端始终返回 false，客户端返回 true
 * 使用 useSyncExternalStore 确保 hydration 一致性
 */
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 企业级 hydration hook
 *
 * 基于 React 18 useSyncExternalStore，比 useEffect + useState 更高效
 * - 无闪烁：不会导致额外的重渲染
 * - 类型安全：完整的 TypeScript 支持
 * - SSR 安全：服务端和客户端行为一致
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isHydrated = useHydrated();
 *
 *   if (!isHydrated) {
 *     return <Skeleton />;
 *   }
 *
 *   return <DynamicContent />;
 * }
 * ```
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

// ============================================================================
// Context: 全局 Hydration 状态管理
// ============================================================================

interface HydrationContextValue {
  isHydrated: boolean;
}

const HydrationContext = createContext<HydrationContextValue>({
  isHydrated: false,
});

/**
 * Hydration Context Provider
 *
 * 在应用根部使用，避免每个组件单独检测 hydration 状态
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <HydrationProvider>
 *       {children}
 *     </HydrationProvider>
 *   );
 * }
 * ```
 */
export function HydrationProvider({ children }: { children: ReactNode }) {
  const isHydrated = useHydrated();

  return <HydrationContext.Provider value={{ isHydrated }}>{children}</HydrationContext.Provider>;
}

/**
 * 从 Context 获取 hydration 状态
 * 需要在 HydrationProvider 内部使用
 */
export function useHydrationContext(): HydrationContextValue {
  return useContext(HydrationContext);
}

// ============================================================================
// Utilities: 条件渲染工具
// ============================================================================

/**
 * 仅在客户端渲染的值
 *
 * @param clientValue - 客户端返回的值
 * @param serverValue - 服务端返回的值（默认 undefined）
 *
 * @example
 * ```tsx
 * const windowWidth = useClientValue(
 *   () => window.innerWidth,
 *   0
 * );
 * ```
 */
export function useClientValue<T>(clientValue: () => T, serverValue: T): T {
  const isHydrated = useHydrated();
  return isHydrated ? clientValue() : serverValue;
}

/**
 * 仅在客户端执行的回调
 *
 * @param callback - 客户端执行的回调函数
 * @returns 包装后的安全回调
 *
 * @example
 * ```tsx
 * const handleShare = useClientCallback(() => {
 *   navigator.share({ title: 'Hello' });
 * });
 * ```
 */
export function useClientCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T | (() => void) {
  const isHydrated = useHydrated();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (isHydrated) {
        return callback(...args);
      }
    }) as T,
    [isHydrated, callback]
  );
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否在浏览器环境
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * 检查是否在服务端环境
 */
export const isServer = typeof window === 'undefined';
