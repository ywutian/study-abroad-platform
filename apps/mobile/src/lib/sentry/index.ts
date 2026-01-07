/**
 * Sentry 错误追踪配置
 * 
 * 初始化 Sentry SDK，配置错误采集和性能监控
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
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
    enableNativeNagger: false, // 禁用原生警告
    
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
  Sentry.setTag(key, value);
}

/**
 * 添加上下文信息
 */
export function setContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context);
}

/**
 * 手动捕获异常
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * 手动捕获消息
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * 添加面包屑
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * 包装组件的错误边界
 */
export const withErrorBoundary = Sentry.withErrorBoundary;

/**
 * Wrap 导航（用于性能监控）
 */
export const withSentryNavigationContainer = Sentry.withSentryNavigationContainer;

export { Sentry };


