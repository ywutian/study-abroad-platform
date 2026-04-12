import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import type { Notification, GroupedNotifications } from './notification-types';

export function formatNotificationTime(dateStr: string, locale: string): string {
  try {
    const dateFnsLocale = locale === 'zh' ? zhCN : enUS;
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: dateFnsLocale,
    });
  } catch {
    return '';
  }
}

export function getActionUrl(notification: Notification): string | null {
  if (notification.relatedType && notification.relatedId) {
    const typeRoutes: Record<string, string> = {
      case: `/cases/${notification.relatedId}`,
      post: `/forum/${notification.relatedId}`,
      essay: `/essays/${notification.relatedId}`,
      message: '/chat',
      profile: '/profile',
    };
    return typeRoutes[notification.relatedType] ?? null;
  }
  return null;
}

export function groupByDate(notifications: Notification[]): GroupedNotifications {
  const groups: GroupedNotifications = { today: [], yesterday: [], earlier: [] };
  for (const n of notifications) {
    const date = new Date(n.createdAt);
    if (isToday(date)) {
      groups.today.push(n);
    } else if (isYesterday(date)) {
      groups.yesterday.push(n);
    } else {
      groups.earlier.push(n);
    }
  }
  return groups;
}
