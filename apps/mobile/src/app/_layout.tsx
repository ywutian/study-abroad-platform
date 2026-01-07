import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { initI18n } from '@/lib/i18n';
import { initSentry, setUser as setSentryUser } from '@/lib/sentry';
import { useAuthStore } from '@/stores';
import { useThemeStore } from '@/stores/theme';
import { ToastProvider } from '@/components/ui/Toast';
import { Loading } from '@/components/ui/Loading';
import { NetworkProvider, ErrorBoundary } from '@/components/providers';
import { useColors } from '@/utils/theme';

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

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const loadAuth = useAuthStore((state) => state.loadAuth);
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

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <NetworkProvider>
              <ToastProvider>
                <RootLayoutNav />
              </ToastProvider>
            </NetworkProvider>
          </ErrorBoundary>
        </QueryClientProvider>
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
});



