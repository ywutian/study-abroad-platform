import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { initI18n, i18n } from '@/lib/i18n';
import { initSentry, setUser as setSentryUser, captureException } from '@/lib/sentry';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/theme';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import {
  useNotificationRuntime,
  type Notification as AppNotification,
} from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/notification';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { NetworkProvider, ErrorBoundary } from '@/components/providers';
import { useColors, colors as themeColors, withOpacity } from '@/utils/theme';
import { createAsyncStoragePersister, MAX_CACHE_AGE_MS } from '@/lib/query-persister';
import { registerQuerySessionReset } from '@/lib/query-session';
import { prefetchReferenceData, attachCacheMetrics } from '@/lib/query';
import { BIOMETRIC_ENABLED_KEY } from '@/screens/settings/SettingsScreen';
import { shouldActivateBiometricLock } from '@/lib/security/biometric-lock';

// 初始化 Sentry (在 App 外部，仅执行一次)
initSentry();

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        source: 'react-query',
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        source: 'react-query-mutation',
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

const persister = createAsyncStoragePersister();
const persistOptions = { persister, maxAge: MAX_CACHE_AGE_MS };

registerQuerySessionReset(async () => {
  queryClient.clear();
  await persister.removeClient();
});

// Observe cache hit-rates for the app's lifetime (O(1) per event; logs in dev).
attachCacheMetrics(queryClient);

/**
 * Watches for session expiry and shows a toast to inform the user before
 * clearing auth state. This prevents silent data loss.
 */
function SessionExpiredHandler() {
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);
  const logout = useAuthStore((s) => s.logout);
  const toast = useToast();

  useEffect(() => {
    if (sessionExpired) {
      toast.show({
        type: 'error',
        message: i18n.t('auth.sessionExpired'),
        duration: 5000,
      });
      logout().finally(clearSessionExpired);
    }
  }, [sessionExpired, clearSessionExpired, logout, toast]);

  return null;
}

/**
 * Bridges WebSocket events to local push notifications and maintains
 * the global chat socket connection while authenticated.
 */
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { incrementUnread } = useNotificationStore();
  const { scheduleLocalNotification } = useNotificationRuntime();

  // Initialize WebSocket — only runs when auth token is available
  useChatSocket(
    isAuthenticated
      ? {
          onNotification: (data) => {
            incrementUnread();
            scheduleLocalNotification(data as unknown as AppNotification);
          },
        }
      : {}
  );

  return <>{children}</>;
}

const DETAIL_SCREENS = [
  'school/[id]',
  'case/[id]',
  'chat/[id]',
  'ranking',
  'prediction',
  'recommendation/index',
  'find-college',
  'essays',
  'essay/[id]',
  'essay-gallery/index',
  'timeline',
  'assessment',
  'forum',
  'forum/[id]',
  'followers',
  'hall/index',
  'swipe/index',
  'uncommon-app',
  'security',
  'resume',
  'resume/[id]',
  'vault',
  'teams',
  'referral',
  'verification',
  'notifications',
] as const;

const DETAIL_SCREEN_OPTIONS = { title: '' } as const;

/**
 * Redirect unauthenticated users away from protected routes.
 * When user logs out, navigates back to auth screen regardless of current route.
 */
function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    // Wait until auth state is loaded before making navigation decisions
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not logged in and not on auth screen → redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Logged in but on auth screen → redirect to tabs
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);
}

function RootLayoutNav() {
  const colors = useColors();
  const { colorScheme } = useThemeStore();
  useProtectedRoute();
  useSessionTimeout();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
          // native-stack v7: empty headerBackTitle is treated as falsy and iOS
          // falls back to the previous screen's title ("(tabs)" -> "tabs").
          // 'minimal' is the correct API to show only the back chevron.
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        {DETAIL_SCREENS.map((name) => (
          <Stack.Screen key={name} name={name} options={DETAIL_SCREEN_OPTIONS} />
        ))}
        <Stack.Screen
          name="profile"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}

/**
 * Biometric lock screen - shown when biometric auth is enabled and user needs to authenticate.
 */
function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const colors = useColors();
  const authenticating = useRef(false);

  const handleAuthenticate = useCallback(async () => {
    if (authenticating.current || AppState.currentState !== 'active') return;
    authenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: i18n.t('security.biometric.promptMessage'),
        fallbackLabel: i18n.t('security.biometric.fallbackLabel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock();
      }
    } catch {
      // Authentication failed, user can retry
    } finally {
      authenticating.current = false;
    }
  }, [onUnlock]);

  // Auto-prompt only while foregrounded. The lock overlay may mount during
  // app-switcher snapshotting, where iOS cannot present Face ID yet.
  useEffect(() => {
    if (AppState.currentState === 'active') void handleAuthenticate();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void handleAuthenticate();
    });
    return () => subscription.remove();
  }, [handleAuthenticate]);

  return (
    <View style={[styles.biometricContainer, { backgroundColor: colors.background }]}>
      <View style={styles.biometricContent}>
        <View
          style={[
            styles.biometricIconContainer,
            { backgroundColor: withOpacity(colors.primary, 0.08) },
          ]}
        >
          <Ionicons name="finger-print" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.biometricTitle, { color: colors.foreground }]}>
          {i18n.t('security.biometric.lockTitle')}
        </Text>
        <Text style={[styles.biometricSubtitle, { color: colors.foregroundMuted }]}>
          {i18n.t('security.biometric.lockSubtitle')}
        </Text>
        <Button onPress={handleAuthenticate} style={styles.biometricButton}>
          {i18n.t('security.biometric.lockButton')}
        </Button>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const loadAuth = useAuthStore((state) => state.loadAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadTheme = useThemeStore((state) => state.loadTheme);

  useEffect(() => {
    async function prepare() {
      try {
        // Load brand fonts (Geist Mono — signature monospaced numerals).
        // Failure is non-fatal: the app falls back to the system font.
        await Font.loadAsync({
          GeistMono: require('../../assets/fonts/GeistMono.ttf'),
        }).catch(() => undefined);

        // Initialize i18n
        await initI18n();

        // Load theme preference
        await loadTheme();

        // Load auth state
        await loadAuth();

        // Check if biometric lock is enabled
        const biometricEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
        if (biometricEnabled === 'true') {
          // Verify hardware is still available
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            setBiometricLocked(true);
          }
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, [loadAuth, loadTheme]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      void AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY).then((enabled) => {
        if (shouldActivateBiometricLock(state, useAuthStore.getState().isAuthenticated, enabled)) {
          setBiometricLocked(true);
        }
      });
    });
    return () => subscription.remove();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Loading fullScreen />
      </View>
    );
  }

  // Show biometric lock screen if enabled and user is authenticated
  if (biometricLocked && isAuthenticated) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <BiometricLockScreen onUnlock={() => setBiometricLocked(false)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          // After the on-disk cache is restored, warm static reference lists so the
          // first Schools-tab open is instant (no cold fetch). No-op if still fresh.
          onSuccess={() => void prefetchReferenceData(queryClient)}
        >
          <ErrorBoundary>
            <NetworkProvider>
              <ToastProvider>
                <SessionExpiredHandler />
                <RealtimeProvider>
                  <RootLayoutNav />
                </RealtimeProvider>
              </ToastProvider>
            </NetworkProvider>
          </ErrorBoundary>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: themeColors.dark.background,
  },
  // Biometric lock screen styles
  biometricContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  biometricContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  biometricIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  biometricTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  biometricSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  biometricButton: {
    minWidth: 200,
  },
});
