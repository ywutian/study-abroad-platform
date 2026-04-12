'use client';

import { AnimatePresence } from 'framer-motion';
import type { Notification } from './notification-types';
import { NotificationCard } from './notification-card';

interface NotificationGroupProps {
  label: string;
  notifications: Notification[];
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  locale: string;
  viewLabel: string;
  deleteLabel: string;
}

export function NotificationGroup({
  label,
  notifications,
  onRead,
  onRemove,
  locale,
  viewLabel,
  deleteLabel,
}: NotificationGroupProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground px-1">{label}</h3>
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onRead={() => onRead(notification.id)}
            onRemove={() => onRemove(notification.id)}
            locale={locale}
            viewLabel={viewLabel}
            deleteLabel={deleteLabel}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
