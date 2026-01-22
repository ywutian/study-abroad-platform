import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { initI18n } from '@/lib/i18n';
import { initSentry, setUser as setSentryUser } from '@/lib/sentry';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/theme';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotifications, type Notification as AppNotification } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/notification';
import { ToastProvider } from '@/components/ui/Toast';
import { Loading } from '@/components/ui/Loading';
import { Button } from '@/components/ui/Button';
import { NetworkProvider, ErrorBoundary } from '@/components/providers';
import { useColors } from '@/utils/theme';
import { createAsyncStoragePersister, MAX_CACHE_AGE_MS } from '@/lib/query-persister';
import { BIOMETRIC_ENABLED_KEY } from '@/screens/settings/SettingsScreen';

// 初始化 Sentry (在 App 外部，仅执行一次)
initSentry();

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

const persister = createAsyncStoragePersister();
const persistOptions = { persister, maxAge: MAX_CACHE_AGE_MS };

/**
 * Bridges WebSocket events to local push notifications and maintains
 * the global chat socket connection while authenticated.
 */
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { incrementUnread } = useNotificationStore();
  const { scheduleLocalNotification } = useNotifications();

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

function RootLayoutNav() {
  const colors = useColors();
  const { colorScheme } = useThemeStore();

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
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="school/[id]"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="case/[id]"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="ranking"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="prediction"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="recommendation"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="find-college"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="essays"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="essay-gallery"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="timeline"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="assessment"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="forum"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="forum/[id]"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="followers"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="hall"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="swipe"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="uncommon-app"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="subscription"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="security"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="profile"
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

  const handleAuthenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock();
      }
    } catch {
      // Authentication failed, user can retry
    }
  };

  // Auto-prompt on mount
  useEffect(() => {
    handleAuthenticate();
  }, []);

  return (
    <View style={[styles.biometricContainer, { backgroundColor: colors.background }]}>
      <View style={styles.biometricContent}>
        <View style={[styles.biometricIconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="finger-print" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.biometricTitle, { color: colors.foreground }]}>
          Authentication Required
        </Text>
        <Text style={[styles.biometricSubtitle, { color: colors.foregroundMuted }]}>
          Please verify your identity to continue
        </Text>
        <Button onPress={handleAuthenticate} style={styles.biometricButton}>
          Authenticate
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
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ErrorBoundary>
            <NetworkProvider>
              <ToastProvider>
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
    backgroundColor: '#0f172a',
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
