import { NotificationType, type Notification } from './notification.types';

export function isPointsOnlyNotification(notification: Notification): boolean {
  return (
    notification.type === NotificationType.POINTS_EARNED ||
    notification.type === NotificationType.LEVEL_UP
  );
}

export function sanitizeDormantPointCopy(
  notification: Notification,
): Notification {
  return {
    ...notification,
    content: notification.content
      .replace(/，获得\s*\+?\d+\s*积分/g, '')
      .replace(/可获得\s*\+?\d+\s*积分/g, '可以获得更准确的分析和预测')
      .replace(
        /,?\s*(?:and\s+)?(?:earn(?:ed|s)?|receive(?:d|s)?)\s*\+?\d+\s*points?/gi,
        '',
      ),
  };
}
