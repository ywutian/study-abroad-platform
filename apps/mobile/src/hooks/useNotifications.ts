import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import { deepLinkPaths } from '@/lib/linking';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { API_ROUTES, notificationRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useAuthStore } from '@/stores';
import { useNotificationStore } from '@/stores/notification';
import {
  clearRegisteredPushToken,
  getRegisteredPushToken,
  saveRegisteredPushToken,
} from '@/lib/storage/push-token';
import { normalizeVisibleNotifications } from '@/lib/notifications/normalize';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'NEW_FOLLOWER'
  | 'FOLLOW_ACCEPTED'
  | 'NEW_MESSAGE'
  | 'CASE_HELPFUL'
  | 'ESSAY_COMMENT'
  | 'POST_REPLY'
  | 'POST_LIKE'
  | 'VERIFICATION_APPROVED'
  | 'VERIFICATION_REJECTED'
  | 'POINTS_EARNED'
  | 'LEVEL_UP'
  | 'DEADLINE_REMINDER'
  | 'PROFILE_INCOMPLETE'
  | 'CASE_REVIEW_APPROVED'
  | 'CASE_REVIEW_REJECTED'
  | 'NEW_ESSAY_PROMPTS'
  | 'SYSTEM_BROADCAST';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  relatedId?: string;
  relatedType?: string; // case, post, message, conversation
  read: boolean;
  createdAt: string;
}

interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferences {
  source: 'default' | 'user';
  readiness: {
    inAppSurface: boolean;
    redisNotificationFeed: boolean;
    remotePush: boolean;
    email: boolean;
  };
  updatedAt: string | null;
}

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const IS_EXPO_GO_ANDROID = IS_EXPO_GO && Platform.OS === 'android';
type ExpoNotificationsModule = typeof import('expo-notifications');
type NotificationSubscription = import('expo-notifications').EventSubscription;
const Notifications: ExpoNotificationsModule | null = !IS_EXPO_GO_ANDROID
  ? (require('expo-notifications') as ExpoNotificationsModule)
  : null;

// ---------------------------------------------------------------------------
// Notification handler configuration (foreground behaviour)
// ---------------------------------------------------------------------------

if (!IS_EXPO_GO_ANDROID && Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up the Android notification channel. This is required on Android 8+
 * and is a no-op on iOS.
 */
async function setupAndroidChannel(): Promise<void> {
  if (IS_EXPO_GO_ANDROID || !Notifications) {
    return;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });
  }
}

/**
 * Request notification permissions and return the Expo push token.
 * Returns `null` when running on a simulator/emulator or when the user
 * declines the permission prompt.
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (IS_EXPO_GO_ANDROID || !Notifications) {
    console.warn('useNotifications: Expo Go Android does not support remote push registration');
    return null;
  }
  if (!Device.isDevice) {
    console.info('useNotifications: skipping push token registration on simulator/emulator');
    return null;
  }

  await setupAndroidChannel();

  // Check current permission status
  // Note: PermissionResponse type from expo-modules-core has status/granted
  // but pnpm hoisting may cause type resolution issues, so we cast.
  const existingPerms = (await Notifications.getPermissionsAsync()) as {
    status: string;
    granted: boolean;
  };

  // Request permission if not already granted
  if (!existingPerms.granted) {
    const newPerms = (await Notifications.requestPermissionsAsync()) as {
      status: string;
      granted: boolean;
    };
    if (!newPerms.granted) {
      console.warn('useNotifications: push notification permission not granted');
      return null;
    }
  }

  // Retrieve the Expo push token
  const envProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const projectId =
    envProjectId || Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('useNotifications: no valid EAS project ID configured, skipping push token');
    return null;
  }

  if (!Notifications) {
    return null;
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

/**
 * Register the device push token with the backend.
 */
async function registerTokenWithBackend(token: string): Promise<void> {
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
  await apiClient.post(notificationRoutes.pushToken(), { token, platform });
  await saveRegisteredPushToken(token);
}

async function unregisterStoredPushToken(): Promise<void> {
  const token = await getRegisteredPushToken();
  if (!token) return;

  try {
    // Claiming first makes the token exclusive to the current account, so a
    // device that switched accounts can safely remove the previous ownership.
    await registerTokenWithBackend(token);
    await apiClient.delete(notificationRoutes.pushToken(), {
      body: JSON.stringify({ token }),
    });
  } finally {
    await clearRegisteredPushToken();
  }
}

/**
 * Register with exponential backoff retry (max 3 attempts).
 */
async function registerTokenWithRetry(token: string, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await registerTokenWithBackend(token);
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn('useNotifications: failed to register push token after retries', error);
        return; // Don't throw — push registration failure is non-fatal
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

/**
 * Navigate the user to the appropriate screen based on notification type.
 */
export function navigateToNotification(notification: Notification): void {
  const { type, relatedId } = notification;

  switch (type) {
    case 'NEW_MESSAGE':
      if (relatedId) {
        router.push(deepLinkPaths.chat(relatedId) as Href);
      }
      break;

    case 'NEW_FOLLOWER':
    case 'FOLLOW_ACCEPTED':
      router.push('/followers' as Href);
      break;

    case 'CASE_HELPFUL':
    case 'CASE_REVIEW_APPROVED':
    case 'CASE_REVIEW_REJECTED':
      router.push((relatedId ? deepLinkPaths.case(relatedId) : '/(tabs)/cases') as Href);
      break;

    case 'ESSAY_COMMENT':
      router.push((relatedId ? deepLinkPaths.essay(relatedId) : '/essay-gallery') as Href);
      break;

    case 'VERIFICATION_APPROVED':
    case 'VERIFICATION_REJECTED':
      router.push('/verification' as Href);
      break;

    case 'PROFILE_INCOMPLETE':
      router.push(deepLinkPaths.profile() as Href);
      break;

    case 'NEW_ESSAY_PROMPTS':
      if (relatedId) router.push(deepLinkPaths.school(relatedId) as Href);
      break;

    case 'POST_REPLY':
    case 'POST_LIKE':
      if (relatedId) {
        router.push(deepLinkPaths.forum(relatedId) as Href);
      } else {
        router.push('/forum' as Href);
      }
      break;

    case 'DEADLINE_REMINDER':
      router.push(deepLinkPaths.timeline() as Href);
      break;

    // Retired legacy point/level events and broadcasts simply open the app.
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotificationPreferences() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const enabled = isAuthenticated && !!userId;

  const query = useQuery<NotificationPreferences>({
    queryKey: qk.notifications.preferences(userId),
    queryFn: () => apiClient.get(notificationRoutes.preferences()),
    enabled,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (input: { readinessRemotePush?: boolean; readinessEmail?: boolean }) =>
      apiClient.post<NotificationPreferences>(notificationRoutes.preferences(), input),
    onSuccess: (preferences) => {
      queryClient.setQueryData(qk.notifications.preferences(userId), preferences);
    },
  });

  return {
    preferences: query.data,
    isLoadingPreferences: query.isLoading,
    preferencesError: query.error,
    updatePreferences: mutation.mutateAsync,
    isUpdatingPreferences: mutation.isPending,
  };
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const userEmail = useAuthStore((state) => state.user?.email ?? null);

  const { setUnreadCount } = useNotificationStore();
  const notificationsEnabled = isAuthenticated && !!userId;

  // -------------------------------------------------------------------------
  // Fetch notification list
  // -------------------------------------------------------------------------
  const {
    data: notifications = [],
    isLoading: isLoadingNotifications,
    error: notificationsError,
    refetch: refreshNotifications,
  } = useQuery<Notification[]>({
    queryKey: qk.notifications.list(userId),
    queryFn: async () => {
      try {
        const result = await apiClient.get<Notification[]>(API_ROUTES.NOTIFICATIONS);
        if (__DEV__) {
          console.info('useNotifications:list success', {
            userId,
            userEmail,
            count: result.length,
          });
        }
        return normalizeVisibleNotifications(result);
      } catch (error) {
        if (__DEV__) {
          console.warn('useNotifications:list failed', {
            userId,
            userEmail,
            isAuthenticated,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
    enabled: notificationsEnabled,
    staleTime: 30_000, // 30 seconds
    refetchOnMount: 'always',
  });

  // -------------------------------------------------------------------------
  // Fetch unread count
  // -------------------------------------------------------------------------
  const {
    data: unreadCountData,
    error: unreadCountError,
    refetch: refetchUnreadCount,
  } = useQuery<UnreadCountResponse>({
    queryKey: qk.notifications.unreadCount(userId),
    queryFn: async () => {
      try {
        const result = await apiClient.get<UnreadCountResponse>(
          `${API_ROUTES.NOTIFICATIONS}/unread-count`
        );
        if (__DEV__) {
          console.info('useNotifications:unread success', {
            userId,
            userEmail,
            count: result.count,
          });
        }
        return result;
      } catch (error) {
        if (__DEV__) {
          console.warn('useNotifications:unread failed', {
            userId,
            userEmail,
            isAuthenticated,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
    enabled: notificationsEnabled,
    staleTime: 15_000, // 15 seconds
    refetchOnMount: 'always',
  });

  // Keep the Zustand store in sync with the server value
  useEffect(() => {
    if (!notificationsEnabled) {
      setUnreadCount(0);
      return;
    }
    if (unreadCountData !== undefined) {
      setUnreadCount(unreadCountData.count);
    }
  }, [notificationsEnabled, unreadCountData, setUnreadCount]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.post(notificationRoutes.markRead(notificationId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.list(userId) });
      queryClient.invalidateQueries({ queryKey: qk.notifications.unreadCount(userId) });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post(notificationRoutes.readAll()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.list(userId) });
      queryClient.invalidateQueries({ queryKey: qk.notifications.unreadCount(userId) });
      useNotificationStore.getState().resetUnread();
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.delete(notificationRoutes.delete(notificationId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.list(userId) });
      queryClient.invalidateQueries({ queryKey: qk.notifications.unreadCount(userId) });
    },
  });

  const markAsRead = useCallback(
    (notificationId: string) => markAsReadMutation.mutateAsync(notificationId),
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(
    () => markAllAsReadMutation.mutateAsync(),
    [markAllAsReadMutation]
  );

  const deleteNotification = useCallback(
    (notificationId: string) => deleteNotificationMutation.mutateAsync(notificationId),
    [deleteNotificationMutation]
  );

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  return {
    notifications,
    unreadCount: unreadCountData?.count ?? 0,
    isLoadingNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    notificationsError,
    unreadCountError,
  };
}

let lastHandledNotificationResponseId: string | null = null;

/**
 * Owns the single process-wide native notification registration/listener set.
 * Mount this once at the app root; list screens should use useNotifications().
 */
export function useNotificationRuntime() {
  const queryClient = useQueryClient();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { preferences } = useNotificationPreferences();
  const enabled = isAuthenticated && !!userId;
  const remotePushEnabled = preferences?.readiness.remotePush === true;

  const handleResponse = useCallback(
    (response: import('expo-notifications').NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (identifier === lastHandledNotificationResponseId) return;

      const data = response.notification.request.content.data as
        { notification?: Notification } | undefined;
      if (!data?.notification) return;

      lastHandledNotificationResponseId = identifier;
      navigateToNotification(data.notification);
    },
    []
  );

  useEffect(() => {
    if (IS_EXPO_GO_ANDROID || !Notifications || !enabled) return;

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.list(userId) });
      queryClient.invalidateQueries({ queryKey: qk.notifications.unreadCount(userId) });
    });
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(handleResponse);

    // The listener above does not replay the notification that launched a
    // previously terminated app. Consume it explicitly once after auth loads.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleResponse(response);
          return Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch((error) => console.info('useNotifications: cold-start response unavailable', error));

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, [enabled, handleResponse, queryClient, userId]);

  useEffect(() => {
    if (!enabled || preferences === undefined) return;

    if (!remotePushEnabled) {
      void unregisterStoredPushToken().catch((error) =>
        console.info('useNotifications: push-token cleanup unavailable', error)
      );
      setExpoPushToken(null);
      return;
    }

    void registerForPushNotificationsAsync()
      .then(async (token) => {
        if (!token) return;
        await registerTokenWithRetry(token);
        setExpoPushToken(token);
      })
      .catch((error) => console.info('useNotifications: push unavailable', error));
  }, [enabled, preferences, remotePushEnabled]);

  const scheduleLocalNotification = useCallback(
    async (notification: Notification) => {
      if (!remotePushEnabled || IS_EXPO_GO_ANDROID || !Notifications) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.content,
          data: { notification },
        },
        trigger: null,
      });
    },
    [remotePushEnabled]
  );

  return { expoPushToken, remotePushEnabled, scheduleLocalNotification };
}
