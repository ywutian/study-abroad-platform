import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, type Href } from 'expo-router';
import { deepLinkPaths } from '@/lib/linking';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { API_ROUTES, notificationRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import { useNotificationStore } from '@/stores/notification';

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
  await apiClient.post(`${API_ROUTES.NOTIFICATIONS}/push-token`, { token, platform });
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
function navigateToNotification(notification: Notification): void {
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
      router.push('/(tabs)/cases' as Href);
      break;

    case 'ESSAY_COMMENT':
      router.push('/essay-gallery' as Href);
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

    // For all other types (VERIFICATION_*, POINTS_EARNED, LEVEL_UP,
    // PROFILE_INCOMPLETE, etc.) we simply open the app — no deep navigation.
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const notificationQueryKeys = {
  list: (userId: string | null) => ['notifications', userId ?? 'anonymous'] as const,
  unreadCount: (userId: string | null) =>
    ['notifications', userId ?? 'anonymous', 'unread-count'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications() {
  const queryClient = useQueryClient();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);
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
    queryKey: notificationQueryKeys.list(userId),
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
        return result;
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
    queryKey: notificationQueryKeys.unreadCount(userId),
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
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount(userId) });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post(notificationRoutes.readAll()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount(userId) });
      useNotificationStore.getState().resetUnread();
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.delete(notificationRoutes.delete(notificationId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount(userId) });
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
  // Schedule a local notification (useful for WebSocket push while in foreground)
  // -------------------------------------------------------------------------
  const scheduleLocalNotification = useCallback(async (notification: Notification) => {
    if (IS_EXPO_GO_ANDROID || !Notifications) {
      console.warn('useNotifications: skipping local notification scheduling in Expo Go Android');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.content,
        data: { notification },
      },
      trigger: null, // show immediately
    });
  }, []);

  // -------------------------------------------------------------------------
  // Push token registration & listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (IS_EXPO_GO_ANDROID || !Notifications || !notificationsEnabled) {
      return;
    }

    // Register for push notifications
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          setExpoPushToken(token);
          registerTokenWithRetry(token);
        }
      })
      .catch((error) => {
        console.info('useNotifications: push notifications unavailable', error);
      });

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener((event) => {
      // Refresh queries so UI stays up-to-date
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.unreadCount(userId) });
    });

    // User tapped on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { notification?: Notification }
        | undefined;

      if (data?.notification) {
        navigateToNotification(data.notification);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [notificationsEnabled, queryClient, userId]);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  return {
    expoPushToken,
    notifications,
    unreadCount: unreadCountData?.count ?? 0,
    isLoadingNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    scheduleLocalNotification,
    notificationsError,
    unreadCountError,
  };
}
