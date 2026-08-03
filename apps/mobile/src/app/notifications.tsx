/**
 * Notifications Screen — displays user notifications with read/unread state,
 * pull-to-refresh, swipe-to-delete, and mark-all-read header action.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/ui';
import {
  useNotifications,
  navigateToNotification,
  type Notification,
  type NotificationType,
} from '@/hooks/useNotifications';
import {
  useColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  fontFamily,
  withOpacity,
} from '@/utils/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const NOTIFICATION_ICON_MAP: Record<NotificationType, { icon: IoniconsName; colorKey: string }> = {
  NEW_FOLLOWER: { icon: 'person-add', colorKey: 'info' },
  FOLLOW_ACCEPTED: { icon: 'people', colorKey: 'success' },
  NEW_MESSAGE: { icon: 'chatbubble', colorKey: 'primary' },
  CASE_HELPFUL: { icon: 'heart', colorKey: 'error' },
  ESSAY_COMMENT: { icon: 'chatbubble-ellipses', colorKey: 'violet' },
  POST_REPLY: { icon: 'arrow-undo', colorKey: 'info' },
  POST_LIKE: { icon: 'thumbs-up', colorKey: 'warning' },
  VERIFICATION_APPROVED: { icon: 'shield-checkmark', colorKey: 'success' },
  VERIFICATION_REJECTED: { icon: 'shield', colorKey: 'error' },
  POINTS_EARNED: { icon: 'star', colorKey: 'warning' },
  LEVEL_UP: { icon: 'trophy', colorKey: 'warning' },
  DEADLINE_REMINDER: { icon: 'alarm', colorKey: 'error' },
  PROFILE_INCOMPLETE: { icon: 'alert-circle', colorKey: 'warning' },
  CASE_REVIEW_APPROVED: { icon: 'checkmark-circle', colorKey: 'success' },
  CASE_REVIEW_REJECTED: { icon: 'close-circle', colorKey: 'error' },
  NEW_ESSAY_PROMPTS: { icon: 'document-text', colorKey: 'violet' },
  SYSTEM_BROADCAST: { icon: 'megaphone', colorKey: 'info' },
};

function getNotificationVisual(type: NotificationType) {
  return NOTIFICATION_ICON_MAP[type] ?? { icon: 'notifications' as IoniconsName, colorKey: 'info' };
}

/**
 * Relative time string using the i18n `common.time.*` keys.
 */
function timeAgo(
  dateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.time.justNow');
  if (mins < 60) return t('common.time.minutesShort', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.time.hoursShort', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('common.time.daysShort', { count: days });
  const months = Math.floor(days / 30);
  return t('common.time.monthsShort', { count: months });
}

// ---------------------------------------------------------------------------
// Notification Item
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  item: Notification;
  onPress: (item: Notification) => void;
  onDelete: (id: string) => void;
  colors: ReturnType<typeof useColors>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const NotificationItem = React.memo(function NotificationItem({
  item,
  onPress,
  onDelete,
  colors,
  t,
}: NotificationItemProps) {
  const visual = getNotificationVisual(item.type);
  const iconColor = (colors as Record<string, string>)[visual.colorKey] ?? colors.info;

  return (
    <Animated.View entering={FadeInDown.duration(200)}>
      <TouchableOpacity
        onPress={() => onPress(item)}
        activeOpacity={0.7}
        style={[
          styles.notificationItem,
          {
            backgroundColor: item.read ? colors.card : withOpacity(colors.primary, 0.06),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.content}`}
      >
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: withOpacity(iconColor, 0.12) }]}>
          <Ionicons name={visual.icon} size={20} color={iconColor} />
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.notificationTitle,
                { color: colors.foreground },
                !item.read && { fontWeight: fontWeight.bold },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>
          <Text
            style={[styles.notificationBody, { color: colors.foregroundSecondary }]}
            numberOfLines={2}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.notificationTime,
              { color: colors.foregroundMuted, fontFamily: fontFamily.mono },
            ]}
          >
            {timeAgo(item.createdAt, t)}
          </Text>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Ionicons name="trash-outline" size={18} color={colors.foregroundMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const {
    notifications,
    isLoadingNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read), [notifications]);

  const handlePress = useCallback(
    async (item: Notification) => {
      if (!item.read) {
        await markAsRead(item.id);
      }
      navigateToNotification(item);
    },
    [markAsRead]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteNotification(id);
    },
    [deleteNotification]
  );

  const handleMarkAllRead = useCallback(() => {
    if (unreadNotifications.length > 0) {
      markAllAsRead();
    }
  }, [unreadNotifications.length, markAllAsRead]);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem
        item={item}
        onPress={handlePress}
        onDelete={handleDelete}
        colors={colors}
        t={t}
      />
    ),
    [handlePress, handleDelete, colors, t]
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const ListEmptyComponent = useMemo(
    () =>
      isLoadingNotifications ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <EmptyState icon="notifications-off-outline" title={t('notifications.empty')} />
      ),
    [isLoadingNotifications, colors.primary, t]
  );

  const headerRight = useCallback(
    () =>
      unreadNotifications.length > 0 ? (
        <TouchableOpacity
          onPress={handleMarkAllRead}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.markAllRead')}
        >
          <Text style={[styles.markAllText, { color: colors.primary }]}>
            {t('notifications.markAllRead')}
          </Text>
        </TouchableOpacity>
      ) : null,
    [unreadNotifications.length, handleMarkAllRead, colors.primary, t]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: t('notifications.title'),
          headerRight,
        }}
      />
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refreshNotifications()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing['5xl'],
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 72,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  contentContainer: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  notificationTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  notificationBody: {
    fontSize: fontSize.sm,
    marginTop: 2,
    lineHeight: fontSize.sm * 1.4,
  },
  notificationTime: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 40 + spacing.md,
  },
  markAllText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
