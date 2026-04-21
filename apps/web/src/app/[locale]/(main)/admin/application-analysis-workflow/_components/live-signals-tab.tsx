'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import {
  adminRoutes,
  type PaginatedApplicationAnalysisExperimentFeedbackResponse,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

import { MetricCard } from './shared-cards';
import { formatDateTime, humanizeEnum } from './utils';

export function LiveSignalsTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisExperimentFeedbackResponse>({
    queryKey: ['applicationAnalysisExperimentFeedback'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentFeedback(), {
        params: { page: 1, pageSize: 50 },
      }),
  });

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.capability}:${item.category}:${item.sentiment}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('liveSignals.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(grouped).length > 0 ? (
            Object.entries(grouped).map(([key, value]) => (
              <MetricCard key={key} label={key} value={value} />
            ))
          ) : (
            <div className="text-sm text-muted-foreground">{t('liveSignals.empty')}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('liveSignals.feedback')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (
            (data?.items ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {humanizeEnum(item.capability ?? 'GENERAL')} · {humanizeEnum(item.sentiment)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {humanizeEnum(item.category ?? 'UNSPECIFIED')}
                      {item.schoolId ? ` · ${item.schoolId}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline">{formatDateTime(item.createdAt)}</Badge>
                </div>
                {item.notes ? (
                  <div className="mt-2 text-sm text-muted-foreground">{item.notes}</div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
