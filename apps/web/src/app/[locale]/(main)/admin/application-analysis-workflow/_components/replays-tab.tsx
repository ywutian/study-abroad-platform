'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import {
  adminRoutes,
  type PaginatedApplicationAnalysisReplayRunResponse,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

import { MetricCard } from './shared-cards';
import { formatDateTime, humanizeEnum } from './utils';

export function ReplaysTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisReplayRunResponse>({
    queryKey: ['applicationAnalysisReplays'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowReplays(), {
        params: { page: 1, pageSize: 20 },
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('replays.title')}</CardTitle>
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
            {(data?.items ?? []).map((item) => {
              const summary = item.summary ?? {};
              const metrics = item.metrics ?? {};
              const provenance =
                summary.provenance && typeof summary.provenance === 'object'
                  ? (summary.provenance as Record<string, unknown>)
                  : {};
              const renderParityMode =
                summary.renderParityMode && typeof summary.renderParityMode === 'object'
                  ? (summary.renderParityMode as Record<string, unknown>)
                  : {};

              return (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{item.dataset}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.analysisVersion} · {humanizeEnum(item.status)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {formatDateTime(item.finishedAt ?? item.createdAt)}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <MetricCard label={t('replays.goldPassRate')} value={metrics.goldPassRate} />
                    <MetricCard label={t('replays.webRenderPass')} value={metrics.webRenderPass} />
                    <MetricCard
                      label={t('replays.mobileRenderPass')}
                      value={metrics.mobileRenderPass}
                    />
                    <MetricCard
                      label={t('replays.liveGoldPassRate')}
                      value={metrics.liveGoldPassRate}
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <div>
                      {t('replays.caseCount')}:{' '}
                      {String(summary.totalCases ?? item.caseResults?.length ?? 0)}
                    </div>
                    <div>
                      {t('replays.workflowMode')}:{' '}
                      {String(summary.workflowMode ?? summary.mode ?? 'n/a')}
                    </div>
                    <div>
                      {t('replays.commitSha')}:{' '}
                      {String(summary.commitSha ?? provenance.commitSha ?? 'n/a')}
                    </div>
                    <div>
                      {t('replays.renderParityMode')}:{' '}
                      {String(
                        [renderParityMode.web, renderParityMode.mobile, renderParityMode.webVisual]
                          .filter(Boolean)
                          .join(' / ') || 'n/a'
                      )}
                    </div>
                    <div className="truncate">
                      {t('replays.reportPath')}: {String(summary.reportPath ?? 'n/a')}
                    </div>
                    <div className="truncate">
                      {t('replays.reportJsonPath')}: {String(summary.reportJsonPath ?? 'n/a')}
                    </div>
                    <div className="truncate">
                      {t('replays.workflowRunUrl')}: {String(provenance.workflowRunUrl ?? 'n/a')}
                    </div>
                    <div>
                      {t('replays.liveReplayId')}: {String(summary.liveReplayId ?? 'n/a')}
                    </div>
                  </div>
                  {(item.failures?.length ?? 0) > 0 ? (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="font-medium">{t('replays.failures')}</div>
                      <div className="mt-1 space-y-1">
                        {(item.failures as string[]).slice(0, 4).map((failure) => (
                          <div key={failure}>{failure}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {(data?.items?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                {t('replays.empty')}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
