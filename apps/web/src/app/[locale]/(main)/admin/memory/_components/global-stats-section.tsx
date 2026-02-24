'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Database } from 'lucide-react';
import {
  GlobalMemoryStats,
  MEMORY_TYPES,
  ENTITY_TYPES,
  memoryTypeBadge,
  entityTypeBadge,
} from './types';

export function GlobalStatsSection() {
  const t = useTranslations('admin.memory');

  const { data: globalStats } = useQuery({
    queryKey: ['memoryGlobalStats'],
    queryFn: () => apiClient.get<GlobalMemoryStats>('/admin/ai-agent/memory/stats'),
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5" />
          <CardTitle className="text-base">{t('globalStats')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {globalStats ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalMemories')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.totalMemories.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalConversations')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.totalConversations.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalMessages')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.totalMessages.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalEntities')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.totalEntities.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-2">{t('typeDistribution')}</p>
                <div className="flex flex-wrap gap-2">
                  {MEMORY_TYPES.map((type) => (
                    <Badge key={type} className={cn('text-xs', memoryTypeBadge[type])}>
                      {t(`type${type.charAt(0)}${type.slice(1).toLowerCase()}`)} (
                      {globalStats.memoryByType[type] || 0})
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-2">{t('entityDistribution')}</p>
                <div className="flex flex-wrap gap-2">
                  {ENTITY_TYPES.map((type) => (
                    <Badge key={type} className={cn('text-xs', entityTypeBadge[type])}>
                      {t(`entity${type.charAt(0)}${type.slice(1).toLowerCase()}`)} (
                      {globalStats.entityByType[type] || 0})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('newMemories7d')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.recentActivity.memoriesLast7Days}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('newConversations7d')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.recentActivity.conversationsLast7Days}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('newMessages7d')}</p>
                <p className="text-lg font-bold mt-1">
                  {globalStats.recentActivity.messagesLast7Days}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
      </CardContent>
    </Card>
  );
}
