'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck, Trash2, CheckCircle, Sparkles } from 'lucide-react';
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

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiClient.get<Notification[]>(notificationRoutes.list(), {
        params: { limit: 50 },
      }),
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiClient.get<{ count: number }>(notificationRoutes.unreadCount()),
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
