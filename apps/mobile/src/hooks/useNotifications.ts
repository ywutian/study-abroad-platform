import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
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
  | 'PROFILE_INCOMPLETE';

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

// ---------------------------------------------------------------------------
// Notification handler configuration (foreground behaviour)
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up the Android notification channel. This is required on Android 8+
 * and is a no-op on iOS.
 */
async function setupAndroidChannel(): Promise<void> {
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
  // Push tokens only work on physical devices
  if (!Device.isDevice) {
    console.warn('useNotifications: push tokens require a physical device');
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
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('useNotifications: no EAS project ID found');
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
  await apiClient.post('/notifications/push-token', { token, platform });
}

/**
 * Navigate the user to the appropriate screen based on notification type.
 */
function navigateToNotification(notification: Notification): void {
  const { type, relatedId } = notification;

  switch (type) {
    case 'NEW_MESSAGE':
      if (relatedId) {
        router.push(`/chat/${relatedId}` as any);
      }
      break;

    case 'NEW_FOLLOWER':
    case 'FOLLOW_ACCEPTED':
      router.push('/followers' as any);
      break;

    case 'CASE_HELPFUL':
      router.push('/cases' as any);
      break;

    case 'ESSAY_COMMENT':
      router.push('/essay-gallery' as any);
      break;

    case 'POST_REPLY':
    case 'POST_LIKE':
      router.push('/forum' as any);
      break;

    case 'DEADLINE_REMINDER':
      router.push('/timeline' as any);
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

const QUERY_KEYS = {
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications() {
  const queryClient = useQueryClient();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const { setUnreadCount } = useNotificationStore();

  // -------------------------------------------------------------------------
  // Fetch notification list
  // -------------------------------------------------------------------------
  const {
    data: notifications = [],
    isLoading: isLoadingNotifications,
    refetch: refreshNotifications,
  } = useQuery<Notification[]>({
    queryKey: QUERY_KEYS.notifications,
    queryFn: () => apiClient.get<Notification[]>('/notifications'),
    staleTime: 30_000, // 30 seconds
  });

  // -------------------------------------------------------------------------
  // Fetch unread count
  // -------------------------------------------------------------------------
  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery<UnreadCountResponse>({
    queryKey: QUERY_KEYS.unreadCount,
    queryFn: () => apiClient.get<UnreadCountResponse>('/notifications/unread-count'),
    staleTime: 15_000, // 15 seconds
  });

  // Keep the Zustand store in sync with the server value
  useEffect(() => {
    if (unreadCountData !== undefined) {
      setUnreadCount(unreadCountData.count);
    }
  }, [unreadCountData, setUnreadCount]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => apiClient.post(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
      useNotificationStore.getState().resetUnread();
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

  // -------------------------------------------------------------------------
  // Schedule a local notification (useful for WebSocket push while in foreground)
  // -------------------------------------------------------------------------
  const scheduleLocalNotification = useCallback(async (notification: Notification) => {
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
    // Register for push notifications
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          setExpoPushToken(token);
          registerTokenWithBackend(token).catch((error) => {
            console.error('useNotifications: failed to register push token with backend', error);
          });
        }
      })
      .catch((error) => {
        console.error('useNotifications: failed to register for push notifications', error);
      });

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener((event) => {
      // Refresh queries so UI stays up-to-date
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
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
  }, [queryClient]);

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
    refreshNotifications,
    scheduleLocalNotification,
  };
}
