/**
 * Sentry 错误追踪配置
 *
 * 初始化 Sentry SDK，配置错误采集和性能监控
 */

import type { Breadcrumb, SeverityLevel } from '@sentry/react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
type SentryModule = typeof import('@sentry/react-native');

// The SDK starts background cleanup timers as soon as the module is evaluated.
// Do not even load it in local/test builds without a DSN; besides unnecessary
// work, those timers keep Jest alive after every suite has passed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sentry: SentryModule | undefined = SENTRY_DSN ? require('@sentry/react-native') : undefined;

export function initSentry() {
  if (!SENTRY_DSN) {
    // Missing local telemetry is expected and must not trigger React Native's
    // warning overlay. A production build still surfaces the configuration
    // error loudly so release validation can catch it.
    if (!__DEV__) {
      console.warn('Sentry DSN not configured, skipping initialization');
    }
    return;
  }

  Sentry?.init({
    dsn: SENTRY_DSN,

    // 环境配置
    environment: __DEV__ ? 'development' : 'production',

    // 版本信息
    release: Constants.expoConfig?.version,
    dist: Constants.expoConfig?.runtimeVersion?.toString(),

    // 采样率配置
    tracesSampleRate: __DEV__ ? 1.0 : 0.2, // 生产环境采样 20%
    profilesSampleRate: __DEV__ ? 1.0 : 0.1, // 性能分析采样 10%

    // 错误过滤
    beforeSend(event, hint) {
      // 过滤开发环境的某些错误
      if (__DEV__) {
        return event;
      }

      // 过滤网络错误（通常是用户网络问题）
      const error = hint.originalException as Error | undefined;
      if (error?.message?.includes('Network request failed')) {
        return null;
      }

      return event;
    },

    // 启用原生错误捕获
    enableNative: true,

    // 会话追踪
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,

    // 面包屑配置
    maxBreadcrumbs: 50,

    // 附加上下文
    attachScreenshot: true,
    attachViewHierarchy: true,

    // 调试模式（仅开发环境）
    debug: __DEV__,
  });
}

/**
 * 设置用户上下文
 */
export function setUser(user: { id: string; email?: string; role?: string } | null) {
  if (!Sentry) return;
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * 添加自定义标签
 */
export function setTag(key: string, value: string) {
  Sentry?.setTag(key, value);
}

/**
 * 添加上下文信息
 */
export function setContext(name: string, context: Record<string, unknown>) {
  Sentry?.setContext(name, context);
}

/**
 * 手动捕获异常
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry?.captureException(error, {
    extra: context,
  });
}

/**
 * 手动捕获消息
 */
export function captureMessage(message: string, level: SeverityLevel = 'info') {
  Sentry?.captureMessage(message, level);
}

/**
 * 添加面包屑
 */
export function addBreadcrumb(breadcrumb: Breadcrumb) {
  Sentry?.addBreadcrumb(breadcrumb);
}

/**
 * 包装组件的错误边界
 */
export const withErrorBoundary = Sentry?.withErrorBoundary;

export { Sentry };
