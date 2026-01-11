'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  useNotificationsStore, 
  formatNotificationTime,
  type Notification,
  type NotificationType,
} from '@/stores/notifications';
import Link from 'next/link';

// 通知图标映射
const notificationIcons: Record<NotificationType, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  system: Bell,
};

// 通知颜色映射
const notificationColors: Record<NotificationType, string> = {
  info: 'text-blue-500 bg-blue-500/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-destructive bg-destructive/10',
  system: 'text-primary bg-primary/10',
};

// 单个通知项
function NotificationItem({ 
  notification, 
  onRead,
  onRemove,
  viewLabel,
}: { 
  notification: Notification;
  onRead: () => void;
  onRemove: () => void;
  viewLabel: string;
}) {
  const Icon = notificationIcons[notification.type];
  const colorClass = notificationColors[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'group relative flex gap-3 p-3 rounded-lg transition-colors',
        notification.read 
          ? 'bg-transparent hover:bg-muted/50' 
          : 'bg-primary/5 hover:bg-primary/10'
      )}
      onClick={() => !notification.read && onRead()}
    >
      {/* 未读指示器 */}
      {!notification.read && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
      
      {/* 图标 */}
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      
      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          notification.read ? 'text-foreground/80' : 'text-foreground'
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-muted-foreground">
            {formatNotificationTime(notification.timestamp)}
          </span>
          {notification.actionUrl && (
            <Link 
              href={notification.actionUrl}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {notification.actionLabel || viewLabel}
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
      
      {/* 删除按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 h-6 w-6 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
    </motion.div>
  );
}

// 空状态
function EmptyState({ emptyText, emptyHint }: { emptyText: string; emptyHint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Bell className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{emptyText}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {emptyHint}
      </p>
    </div>
  );
}

export function NotificationCenter() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearRead,
  } = useNotificationsStore();

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-tour="notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[380px] p-0" 
        align="end"
        sideOffset={8}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">{t('title')}</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                {t('markAllRead')}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 内容 */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start px-4 pt-2 bg-transparent border-b rounded-none">
            <TabsTrigger value="all" className="relative">
              {t('tabs.all')}
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="relative">
              {t('tabs.unread')}
              {unreadCount > 0 && (
                <Badge variant="default" className="ml-1.5 h-5 px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <EmptyState emptyText={t('empty')} emptyHint={t('emptyHint')} />
              ) : (
                <div className="p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {notifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={() => markAsRead(notification.id)}
                        onRemove={() => removeNotification(notification.id)}
                        viewLabel={t('view')}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unread" className="mt-0">
            <ScrollArea className="h-[400px]">
              {unreadNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="w-8 h-8 text-success mb-2" />
                  <p className="text-sm text-muted-foreground">{t('allRead')}</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {unreadNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={() => markAsRead(notification.id)}
                        onRemove={() => removeNotification(notification.id)}
                        viewLabel={t('view')}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* 底部 */}
        {readNotifications.length > 0 && (
          <div className="px-4 py-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs text-muted-foreground hover:text-destructive"
              onClick={clearRead}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              {t('clearRead')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}



