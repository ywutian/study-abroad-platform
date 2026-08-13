'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { BarChart3, Clock, TrendingUp, Users } from 'lucide-react';

interface ModerationStats {
  overall: {
    queueDepth: number;
    pendingReports: number;
    pendingStaging: number;
    throughputToday: number;
    throughputTrend: Array<{ date: string; count: number }>;
  };
  perReviewer: Array<{
    userId: string;
    email: string;
    itemsReviewed: { today: number; week: number; month: number };
  }>;
}

type Period = 'today' | 'week' | 'month';

export function ReviewStatisticsTab() {
  const t = useTranslations('admin.reviewStats');
  const [period, setPeriod] = useState<Period>('week');

  const { data, isLoading } = useQuery({
    queryKey: ['moderationStatistics', period],
    queryFn: () =>
      apiClient.get<ModerationStats>(adminRoutes.moderationStatistics(), {
        params: { period },
      }),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const overall = data.overall ?? {
    queueDepth: 0,
    pendingReports: 0,
    pendingStaging: 0,
    throughputToday: 0,
    throughputTrend: [],
  };
  const perReviewer = Array.isArray(data.perReviewer) ? data.perReviewer : [];

  // Simple bar chart using divs
  const trend = overall.throughputTrend ?? [];
  const maxCount = Math.max(1, ...trend.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('period')}:</span>
        <div className="flex rounded-lg border border-border p-0.5">
          {(['today', 'week', 'month'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              className="h-10 px-3 text-xs md:h-8"
              onClick={() => setPeriod(p)}
            >
              {t(p)}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overall.queueDepth}</p>
                <p className="text-xs text-muted-foreground">{t('queueDepth')}</p>
              </div>
            </div>
            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
              <span>{overall.pendingReports} reports</span>
              <span>·</span>
              <span>{overall.pendingStaging} staging</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overall.throughputToday}</p>
                <p className="text-xs text-muted-foreground">{t('throughputToday')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{perReviewer.length}</p>
                <p className="text-xs text-muted-foreground">{t('activeReviewers')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Throughput trend (simple bar chart) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('throughputTrend')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-24">
            {trend.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80 transition-all min-h-[2px]"
                  style={{ height: `${(day.count / maxCount) * 80}px` }}
                />
                <span className="text-2xs text-muted-foreground">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-reviewer table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('reviewer')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perReviewer.length > 0 ? (
            <div className="space-y-2">
              {perReviewer.map((reviewer) => (
                <div
                  key={reviewer.userId}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {reviewer.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{reviewer.email.split('@')[0]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {t('today')}: {reviewer.itemsReviewed.today}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {t('thisWeek')}: {reviewer.itemsReviewed.week}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {t('thisMonth')}: {reviewer.itemsReviewed.month}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t('noData')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
