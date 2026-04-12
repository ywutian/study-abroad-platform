'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import {
  adminRoutes,
  type PaginatedApplicationAnalysisEvaluationResponse,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

import { MetricCard } from './shared-cards';
import { formatDateTime, humanizeEnum } from './utils';

export function EvaluationsTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisEvaluationResponse>({
    queryKey: ['applicationAnalysisEvaluations'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowEvaluations(), {
        params: { page: 1, pageSize: 20 },
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('evaluations.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(data?.items ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {item.policyVersion?.version ?? item.policyVersionId}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {humanizeEnum(item.mode)} · {humanizeEnum(item.status)}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {formatDateTime(item.finishedAt ?? item.createdAt)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MetricCard
                    label={t('evaluations.policyCorrectnessRate')}
                    value={item.metrics?.policyCorrectnessRate}
                  />
                  <MetricCard
                    label={t('evaluations.weakStateCorrectnessRate')}
                    value={item.metrics?.weakStateCorrectnessRate}
                  />
                  <MetricCard
                    label={t('evaluations.actionabilityMean')}
                    value={item.metrics?.actionabilityMean}
                  />
                </div>
              </div>
            ))}
            {(data?.items?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {t('evaluations.empty')}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
