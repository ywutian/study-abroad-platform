'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck, Trash2, CheckCircle, Lightbulb } from 'lucide-react';
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
import { apiClient } from '@/lib/api';
import { notificationRoutes } from '@study-abroad/shared';
import { qk, cachePolicy } from '@/lib/query';
import { useAuthReady } from '@/hooks/use-auth-gated-query';

import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';

import type { Notification } from './_components/notification-types';
import { groupByDate } from './_components/notification-utils';
import { NotificationGroup } from './_components/notification-group';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isClientReady, setIsClientReady] = useState(false);
  const authReady = useAuthReady();

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: qk.notifications.all,
    queryFn: () =>
      apiClient.get<Notification[]>(notificationRoutes.list(), {
        params: { limit: 50 },
      }),
    ...cachePolicy.realtime,
    enabled: authReady,
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: qk.notifications.unreadCount(),
    queryFn: () => apiClient.get<{ count: number }>(notificationRoutes.unreadCount()),
    refetchInterval: 30000,
    ...cachePolicy.realtime,
    enabled: authReady,
  });
  const unreadCount = unreadData?.count || 0;
  const displayNotifications = isClientReady ? notifications : [];
  const displayUnreadCount = isClientReady ? unreadCount : 0;

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(notificationRoutes.markRead(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({
        queryKey: qk.notifications.unreadCount(),
      });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post(notificationRoutes.readAll()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({
        queryKey: qk.notifications.unreadCount(),
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(notificationRoutes.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({
        queryKey: qk.notifications.unreadCount(),
      });
    },
  });

  // Clear all
  const clearAllMutation = useMutation({
    mutationFn: () => apiClient.delete(notificationRoutes.list()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications.all });
      queryClient.invalidateQueries({
        queryKey: qk.notifications.unreadCount(),
      });
    },
  });

  const filteredNotifications = useMemo(
    () =>
      activeTab === 'unread'
        ? displayNotifications.filter((notification) => !notification.read)
        : displayNotifications,
    [displayNotifications, activeTab]
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
          displayUnreadCount > 0
            ? [
                {
                  label: t('tabs.unread'),
                  value: displayUnreadCount,
                  icon: BellRing,
                },
              ]
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {displayUnreadCount > 0 && (
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
            {displayNotifications.length > 0 && (
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
          {displayNotifications.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {displayNotifications.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('unread')}
        >
          {t('tabs.unread')}
          {displayUnreadCount > 0 && (
            <Badge className="ml-1.5 h-5 px-1.5 text-xs bg-primary">{displayUnreadCount}</Badge>
          )}
        </Button>
      </div>

      {/* Content */}
      {!isClientReady || isLoading ? (
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
                <Lightbulb className="w-8 h-8 text-muted-foreground" />
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
