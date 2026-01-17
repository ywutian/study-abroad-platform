'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  ExternalLink,
  UserPlus,
  MessageSquare,
  Heart,
  Award,
  BadgeCheck,
  Coins,
  Calendar,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  relatedId?: string;
  relatedType?: string;
  read: boolean;
  createdAt: string;
}

// 通知图标映射
const notificationIcons: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  system: Bell,
  NEW_FOLLOWER: UserPlus,
  FOLLOW_ACCEPTED: UserPlus,
  NEW_MESSAGE: MessageSquare,
  CASE_HELPFUL: Heart,
  ESSAY_COMMENT: MessageSquare,
  POST_REPLY: MessageSquare,
  POST_LIKE: Heart,
  VERIFICATION_APPROVED: BadgeCheck,
  VERIFICATION_REJECTED: XCircle,
  POINTS_EARNED: Coins,
  LEVEL_UP: Award,
  DEADLINE_REMINDER: Calendar,
  PROFILE_INCOMPLETE: AlertTriangle,
};

// 通知颜色映射
const notificationColors: Record<string, string> = {
  info: 'text-blue-500 bg-blue-500/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-destructive bg-destructive/10',
  system: 'text-primary bg-primary/10',
  NEW_FOLLOWER: 'text-blue-500 bg-blue-500/10',
  FOLLOW_ACCEPTED: 'text-blue-500 bg-blue-500/10',
  NEW_MESSAGE: 'text-indigo-500 bg-indigo-500/10',
  CASE_HELPFUL: 'text-pink-500 bg-pink-500/10',
  ESSAY_COMMENT: 'text-primary bg-primary/10',
  POST_REPLY: 'text-cyan-500 bg-cyan-500/10',
  POST_LIKE: 'text-pink-500 bg-pink-500/10',
  VERIFICATION_APPROVED: 'text-emerald-500 bg-emerald-500/10',
  VERIFICATION_REJECTED: 'text-red-500 bg-red-500/10',
  POINTS_EARNED: 'text-amber-500 bg-amber-500/10',
  LEVEL_UP: 'text-orange-500 bg-orange-500/10',
  DEADLINE_REMINDER: 'text-red-500 bg-red-500/10',
  PROFILE_INCOMPLETE: 'text-yellow-500 bg-yellow-500/10',
};

// 格式化时间（locale 感知）
function formatNotificationTime(dateStr: string, locale: string): string {
  try {
    const dateFnsLocale = locale === 'zh' ? zhCN : enUS;
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateFnsLocale });
  } catch {
    return '';
  }
}

// 单个通知项
function NotificationItem({
  notification,
  onRead,
  onRemove,
  viewLabel,
  locale,
}: {
  notification: Notification;
  onRead: () => void;
  onRemove: () => void;
  viewLabel: string;
  locale: string;
}) {
  const Icon = notificationIcons[notification.type] || Bell;
  const colorClass = notificationColors[notification.type] || 'text-gray-500 bg-gray-500/10';

  // 根据类型生成链接
  const getActionUrl = () => {
    if (notification.relatedType && notification.relatedId) {
      const typeRoutes: Record<string, string> = {
        case: `/cases/${notification.relatedId}`,
        post: `/forum/${notification.relatedId}`,
        essay: `/essays/${notification.relatedId}`,
        message: '/chat',
        profile: '/profile',
      };
      return typeRoutes[notification.relatedType];
    }
    return null;
  };

  const actionUrl = getActionUrl();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'group relative flex gap-3 p-3 rounded-lg transition-colors cursor-pointer',
        notification.read ? 'bg-transparent hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'
      )}
      onClick={() => !notification.read && onRead()}
    >
      {/* 未读指示器 */}
      {!notification.read && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      {/* 图标 */}
      <div
        className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          colorClass
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            notification.read ? 'text-foreground/80' : 'text-foreground'
          )}
        >
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.content}</p>
        <div className="flex items-center gap-2 mt-1.5">
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

      {/* 删除按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 h-7 w-7 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </Button>
    </motion.div>
  );
}

// 空状态
function EmptyState({ emptyText, emptyHint }: { emptyText: string; emptyHint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center mb-3">
        <Sparkles className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{emptyText}</p>
      <p className="text-xs text-muted-foreground mt-1">{emptyHint}</p>
    </div>
  );
}

export function NotificationCenter() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // 获取未读数量
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiClient.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30000, // 30秒刷新一次
  });
  const unreadCount = unreadData?.count || 0;

  // 获取通知列表
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get<Notification[]>('/notifications?limit=50'),
    enabled: open,
  });

  // 标记已读
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // 标记全部已读
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // 删除通知
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // 清空所有
  const clearAllMutation = useMutation({
    mutationFn: () => apiClient.delete('/notifications'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-tour="notifications">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 text-amber-500" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 flex items-center justify-center text-2xs font-bold"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end" sideOffset={8}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h4 className="font-semibold">{t('title')}</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {t('unreadCount', { count: unreadCount })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                {t('markAllRead')}
              </Button>
            )}
          </div>
        </div>

        {/* 内容 */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start px-4 pt-2 bg-transparent border-b rounded-none h-auto">
            <TabsTrigger value="all" className="relative data-[state=active]:shadow-none">
              {t('tabs.all')}
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="relative data-[state=active]:shadow-none">
              {t('tabs.unread')}
              {unreadCount > 0 && (
                <Badge className="ml-1.5 h-5 px-1.5 text-xs bg-primary">{unreadCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-9 w-9 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-3 w-full bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState emptyText={t('empty')} emptyHint={t('emptyHint')} />
              ) : (
                <div className="p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={() => markAsReadMutation.mutate(notification.id)}
                        onRemove={() => deleteNotificationMutation.mutate(notification.id)}
                        viewLabel={t('view')}
                        locale={locale}
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
                  <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
                  <p className="text-sm font-medium">{t('allRead')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('noUnread')}</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  <AnimatePresence mode="popLayout">
                    {unreadNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={() => markAsReadMutation.mutate(notification.id)}
                        onRemove={() => deleteNotificationMutation.mutate(notification.id)}
                        viewLabel={t('view')}
                        locale={locale}
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
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
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
