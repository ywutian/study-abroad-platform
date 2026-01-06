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

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { accessToken, setLoading } = useAuthStore();

  useEffect(() => {
    // Mark as loaded after hydration
    setLoading(false);

    // Start token refresh interval if authenticated
    if (accessToken) {
      startTokenRefreshInterval();
    }

    return () => {
      stopTokenRefreshInterval();
    };
  }, [accessToken, setLoading]);

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
