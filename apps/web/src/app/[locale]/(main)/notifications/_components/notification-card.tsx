'use client';

import { motion } from 'framer-motion';
import { Bell, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import type { Notification } from './notification-types';
import { notificationIcons, notificationColors } from './notification-types';
import { formatNotificationTime, getActionUrl } from './notification-utils';

interface NotificationCardProps {
  notification: Notification;
  onRead: () => void;
  onRemove: () => void;
  locale: string;
  viewLabel: string;
  deleteLabel: string;
}

export function NotificationCard({
  notification,
  onRead,
  onRemove,
  locale,
  viewLabel,
  deleteLabel,
}: NotificationCardProps) {
  const Icon = notificationIcons[notification.type] || Bell;
  const colorClass = notificationColors[notification.type] || 'text-muted-foreground bg-muted';
  const actionUrl = getActionUrl(notification);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card
        className={cn(
          'transition-colors cursor-pointer group',
          notification.read
            ? 'bg-card hover:bg-muted/50'
            : 'bg-primary/5 hover:bg-primary/10 border-primary/20'
        )}
        onClick={() => !notification.read && onRead()}
      >
        <CardContent className="flex items-start gap-4 p-4">
          {/* Unread indicator */}
          {!notification.read && (
            <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
          )}

          {/* Icon */}
          <div
            className={cn(
              'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              colorClass
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                notification.read ? 'text-foreground/80' : 'text-foreground'
              )}
            >
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {notification.content}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">
                {formatNotificationTime(notification.createdAt, locale)}
              </span>
              {actionUrl && (
                <Link
                  href={actionUrl}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {viewLabel}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-0 group-hover:opacity-100 h-8 w-8"
            aria-label={deleteLabel}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
