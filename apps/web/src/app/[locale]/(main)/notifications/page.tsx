'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  UserPlus,
  MessageSquare,
  Heart,
  Award,
  BadgeCheck,
  Coins,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { notificationRoutes } from '@study-abroad/shared';
import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';
import { Link } from '@/lib/i18n/navigation';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

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

// Notification icon mapping
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

// Notification color mapping
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

function formatNotificationTime(dateStr: string, locale: string): string {
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

function getActionUrl(notification: Notification): string | null {
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

interface GroupedNotifications {
  today: Notification[];
  yesterday: Notification[];
  earlier: Notification[];
}

function groupByDate(notifications: Notification[]): GroupedNotifications {
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

function NotificationCard({
  notification,
  onRead,
  onRemove,
  locale,
  viewLabel,
  deleteLabel,
}: {
  notification: Notification;
  onRead: () => void;
  onRemove: () => void;
  locale: string;
  viewLabel: string;
  deleteLabel: string;
}) {
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

function NotificationGroup({
  label,
  notifications,
  onRead,
  onRemove,
  locale,
  viewLabel,
  deleteLabel,
}: {
  label: string;
  notifications: Notification[];
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  locale: string;
  viewLabel: string;
  deleteLabel: string;
}) {
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

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiClient.get<Notification[]>('/notifications', {
        params: { limit: 50 },
      }),
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiClient.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(notificationRoutes.markRead(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post(notificationRoutes.readAll()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(notificationRoutes.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      });
    },
  });

  // Clear all
  const clearAllMutation = useMutation({
    mutationFn: () => apiClient.delete(notificationRoutes.list()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread-count'],
      });
    },
  });

  const filteredNotifications = useMemo(
    () => (activeTab === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, activeTab]
  );

  const grouped = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications]);

  const hasNotifications = filteredNotifications.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title={t('title')}
        description={t('pageDescription')}
        icon={Bell}
        color="blue"
        stats={
          unreadCount > 0
            ? [
                {
                  label: t('tabs.unread'),
                  value: unreadCount,
                  icon: BellRing,
                },
              ]
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                <CheckCheck className="w-4 h-4 mr-1.5" />
                {t('markAllRead')}
              </Button>
            )}
            {notifications.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    {t('clearAll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('clearAll')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('confirmClearAll')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearAllMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      {/* Tab filter */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('all')}
        >
          {t('tabs.all')}
          {notifications.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {notifications.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('unread')}
        >
          {t('tabs.unread')}
          {unreadCount > 0 && (
            <Badge className="ml-1.5 h-5 px-1.5 text-xs bg-primary">{unreadCount}</Badge>
          )}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasNotifications ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mb-4">
              {activeTab === 'unread' ? (
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              ) : (
                <Sparkles className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              {activeTab === 'unread' ? t('allRead') : t('empty')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === 'unread' ? t('noUnread') : t('emptyHint')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <NotificationGroup
            label={t('today')}
            notifications={grouped.today}
            onRead={(id) => markAsReadMutation.mutate(id)}
            onRemove={(id) => deleteNotificationMutation.mutate(id)}
            locale={locale}
            viewLabel={t('view')}
            deleteLabel={t('deleteNotification')}
          />
          <NotificationGroup
            label={t('yesterday')}
            notifications={grouped.yesterday}
            onRead={(id) => markAsReadMutation.mutate(id)}
            onRemove={(id) => deleteNotificationMutation.mutate(id)}
            locale={locale}
            viewLabel={t('view')}
            deleteLabel={t('deleteNotification')}
          />
          <NotificationGroup
            label={t('earlier')}
            notifications={grouped.earlier}
            onRead={(id) => markAsReadMutation.mutate(id)}
            onRemove={(id) => deleteNotificationMutation.mutate(id)}
            locale={locale}
            viewLabel={t('view')}
            deleteLabel={t('deleteNotification')}
          />
        </div>
      )}
    </PageContainer>
  );
}
