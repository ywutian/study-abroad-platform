'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Loader2, Users } from 'lucide-react';
import { EnhancedMemoryStats, memoryTypeBadge } from './types';

export function UserQuerySection() {
  const t = useTranslations('admin.memory');
  const [userIdInput, setUserIdInput] = useState('');
  const [queryUserId, setQueryUserId] = useState('');

  const { data: userStats, isFetching: userStatsFetching } = useQuery({
    queryKey: ['memoryUserStats', queryUserId],
    queryFn: () =>
      apiClient.get<EnhancedMemoryStats>(`/admin/ai-agent/memory/users/${queryUserId}/stats`),
    enabled: !!queryUserId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5" />
          <div>
            <CardTitle className="text-base">{t('userQuery')}</CardTitle>
            <CardDescription className="mt-1">{t('userStats')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder={t('userIdPlaceholder')}
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && userIdInput && setQueryUserId(userIdInput)}
          />
          <Button
            onClick={() => userIdInput && setQueryUserId(userIdInput)}
            disabled={!userIdInput || userStatsFetching}
          >
            {userStatsFetching && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {t('queryBtn')}
          </Button>
        </div>

        {userStats && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalMemories')}</p>
                <p className="text-lg font-bold mt-1">{userStats.totalMemories}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalConversations')}</p>
                <p className="text-lg font-bold mt-1">{userStats.totalConversations}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalMessages')}</p>
                <p className="text-lg font-bold mt-1">{userStats.totalMessages}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('totalEntities')}</p>
                <p className="text-lg font-bold mt-1">{userStats.totalEntities}</p>
              </div>
            </div>

            {userStats.memoryByType && Object.keys(userStats.memoryByType).length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-2">{t('typeDistribution')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(userStats.memoryByType).map(([type, count]) => (
                    <Badge key={type} className={cn('text-xs', memoryTypeBadge[type])}>
                      {type} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {userStats.decay && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-2">{t('tierDist')}</p>
                <div className="space-y-2">
                  {(['SHORT', 'LONG', 'ARCHIVE'] as const).map((tier) => {
                    const count = userStats.decay?.byTier[tier] || 0;
                    const total = userStats.decay?.totalMemories || 1;
                    return (
                      <div key={tier} className="flex items-center gap-2">
                        <span className="text-xs w-16">
                          {t(`tier${tier.charAt(0)}${tier.slice(1).toLowerCase()}`)}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2"
                            style={{ width: `${Math.min((count / total) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                  <span>
                    {t('avgImportance')}: {(userStats.decay.averageImportance * 100).toFixed(0)}%
                  </span>
                  <span>
                    {t('avgFreshness')}: {(userStats.decay.averageFreshness * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {userStats.scoring && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('avgImportance')}: {(userStats.scoring.averageScore * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
