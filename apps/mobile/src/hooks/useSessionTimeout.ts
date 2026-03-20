/**
 * Session Timeout Hook
 * Monitors app state transitions and requires re-authentication
 * after extended background periods (>15 minutes).
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuthStore();
  const backgroundTimestamp = useRef<number | null>(null);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (!isAuthenticated) return;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Record when app went to background
        backgroundTimestamp.current = Date.now();
      } else if (nextAppState === 'active' && backgroundTimestamp.current) {
        // Check if session timed out
        const elapsed = Date.now() - backgroundTimestamp.current;
        backgroundTimestamp.current = null;

        if (elapsed > SESSION_TIMEOUT_MS) {
          logout();
          router.replace('/(auth)/login');
        }
      }
    },
    [isAuthenticated, logout]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);
}
