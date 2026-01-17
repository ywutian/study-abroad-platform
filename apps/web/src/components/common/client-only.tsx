'use client';

/**
 * ClientOnly 组件
 *
 * 企业级客户端专属渲染组件，用于包装可能导致 Hydration Mismatch 的内容
 *
 * 设计原则：
 * 1. 零配置：开箱即用，无需额外设置
 * 2. 性能优先：使用 useSyncExternalStore 避免双重渲染
 * 3. 可访问性：支持 SSR 骨架屏和占位符
 * 4. 灵活性：支持多种渲染策略
 */

import { ReactNode, Suspense, ComponentType, memo } from 'react';
import { useHydrated } from '@/hooks/use-hydration';

// ============================================================================
// ClientOnly 组件
// ============================================================================

export interface ClientOnlyProps {
  /** 客户端渲染的内容 */
  children: ReactNode;
  /** 服务端渲染的占位内容（可选） */
  fallback?: ReactNode;
  /** 是否在 SSR 时完全隐藏（无 fallback） */
  defer?: boolean;
}

/**
 * 仅在客户端渲染的组件包装器
 *
 * @example
 * ```tsx
 * // 基础用法
 * <ClientOnly>
 *   <DynamicComponent />
 * </ClientOnly>
 *
 * // 带骨架屏
 * <ClientOnly fallback={<Skeleton />}>
 *   <Chart data={data} />
 * </ClientOnly>
 *
 * // 延迟渲染（不显示占位符）
 * <ClientOnly defer>
 *   <FloatingButton />
 * </ClientOnly>
 * ```
 */
export function ClientOnly({ children, fallback = null, defer = false }: ClientOnlyProps) {
  const isHydrated = useHydrated();

  if (!isHydrated) {
    return defer ? null : <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// ClientGate 高阶组件
// ============================================================================

export interface ClientGateOptions<_P> {
  /** 加载时显示的组件 */
  LoadingComponent?: ComponentType;
  /** 传递给加载组件的 props */
  loadingProps?: Record<string, unknown>;
  /** 组件显示名称（用于调试） */
  displayName?: string;
  /** 是否使用 Suspense 边界 */
  suspense?: boolean;
}

/**
 * 高阶组件：将组件转换为仅客户端渲染
 *
 * @example
 * ```tsx
 * // 基础用法
 * const ClientChart = withClientOnly(Chart);
 *
 * // 带加载状态
 * const ClientMap = withClientOnly(Map, {
 *   LoadingComponent: MapSkeleton,
 *   displayName: 'ClientMap'
 * });
 * ```
 */
export function withClientOnly<P extends object>(
  Component: ComponentType<P>,
  options: ClientGateOptions<P> = {}
): ComponentType<P> {
  const { LoadingComponent, loadingProps = {}, displayName, suspense = false } = options;

  const WrappedComponent = memo(function ClientGatedComponent(props: P) {
    const isHydrated = useHydrated();

    if (!isHydrated) {
      if (LoadingComponent) {
        return <LoadingComponent {...loadingProps} />;
      }
      return null;
    }

    const content = <Component {...props} />;

    if (suspense) {
      return (
        <Suspense fallback={LoadingComponent ? <LoadingComponent {...loadingProps} /> : null}>
          {content}
        </Suspense>
      );
    }

    return content;
  });

  WrappedComponent.displayName =
    displayName || `ClientOnly(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

// ============================================================================
// NoSSR 组件（别名，语义更清晰）
// ============================================================================

/**
 * NoSSR 组件
 *
 * ClientOnly 的语义别名，明确表示禁用 SSR
 *
 * @example
 * ```tsx
 * <NoSSR>
 *   <BrowserOnlyFeature />
 * </NoSSR>
 * ```
 */
export const NoSSR = ClientOnly;

// ============================================================================
// HydrationBoundary 组件
// ============================================================================

export interface HydrationBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 是否抑制 hydration 警告 */
  suppressWarning?: boolean;
}

/**
 * Hydration 边界组件
 *
 * 用于包装已知会有 hydration 差异但可以安全忽略的内容
 * 例如：时间戳、随机广告位等
 *
 * @example
 * ```tsx
 * <HydrationBoundary suppressWarning>
 *   <Timestamp date={new Date()} />
 * </HydrationBoundary>
 * ```
 */
export function HydrationBoundary({ children, suppressWarning = false }: HydrationBoundaryProps) {
  return <span suppressHydrationWarning={suppressWarning}>{children}</span>;
}

// ============================================================================
// Exports
// ============================================================================

export default ClientOnly;
