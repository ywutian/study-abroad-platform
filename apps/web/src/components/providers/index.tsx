'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from './query-provider';
import { ProgressProvider } from './progress-provider';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { TourProvider } from '@/components/features/onboarding/tour-provider';
import { FeedbackWidget } from '@/components/features/feedback/feedback-widget';
import { useAuthStore, startTokenRefreshInterval, stopTokenRefreshInterval } from '@/stores/auth';

/**
 * 认证状态初始化器
 * 
 * 在应用启动时：
 * 1. 尝试使用 httpOnly cookie 中的 refreshToken 恢复会话
 * 2. 成功后启动自动刷新定时器
 * 
 * 安全说明：
 * - AccessToken 仅存储在内存中，页面刷新后需要重新获取
 * - RefreshToken 通过 httpOnly cookie 自动发送，JavaScript 无法访问
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { accessToken, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    // 初始化认证状态（尝试通过 cookie 恢复会话）
    initialize();
  }, [initialize]);

  useEffect(() => {
    // 认证成功后启动自动刷新定时器
    if (accessToken) {
      startTokenRefreshInterval();
    }

    return () => {
      stopTokenRefreshInterval();
    };
  }, [accessToken]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          <ProgressProvider>
            <TourProvider>
              <AuthInitializer>{children}</AuthInitializer>
              <Toaster position="top-center" richColors />
              <OfflineIndicator />
              <FeedbackWidget />
            </TourProvider>
          </ProgressProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
