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
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <MetricCard
                    label={t('evaluations.webVisualPass')}
                    value={item.metrics?.webVisualPass}
                  />
                  <MetricCard
                    label={t('evaluations.liveGoldPassRate')}
                    value={item.metrics?.liveGoldPassRate}
                  />
                  <MetricCard
                    label={t('evaluations.journeyPassRate')}
                    value={item.metrics?.journeyPassRate}
                  />
                </div>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    {t('evaluations.caseCount')}:{' '}
                    {String(item.scopeSummary?.totalCases ?? item.counts?.goldReplayCaseCount ?? 0)}
                  </div>
                  <div>
                    {t('evaluations.workflowMode')}:{' '}
                    {String(item.counts?.workflowMode ?? item.scopeSummary?.mode ?? 'n/a')}
                  </div>
                  <div>
                    {t('evaluations.dataset')}:{' '}
                    {String(item.scopeSummary?.dataset ?? item.counts?.replayDataset ?? 'n/a')}
                  </div>
                  <div>
                    {t('evaluations.replayMode')}:{' '}
                    {String(item.scopeSummary?.mode ?? item.counts?.replayMode ?? 'n/a')}
                  </div>
                  <div>
                    {t('evaluations.evidenceMode')}: {String(item.counts?.evidenceMode ?? 'n/a')}
                  </div>
                  <div>
                    {t('evaluations.realEvidenceCount')}:{' '}
                    {String(item.counts?.realApprovedEvidenceCount ?? 0)}
                  </div>
                  <div>
                    {t('evaluations.fixtureEvidenceCount')}:{' '}
                    {String(item.counts?.fixtureApprovedEvidenceCount ?? 0)}
                  </div>
                  <div>
                    {t('evaluations.commitSha')}:{' '}
                    {String(item.scopeSummary?.commitSha ?? item.counts?.replayCommitSha ?? 'n/a')}
                  </div>
                  <div>
                    {t('evaluations.latestReplayId')}:{' '}
                    {String(item.counts?.latestReplayId ?? 'n/a')}
                  </div>
                  <div className="truncate">
                    {t('evaluations.reportPath')}:{' '}
                    {String(
                      item.scopeSummary?.reportPath ?? item.counts?.replayReportPath ?? 'n/a'
                    )}
                  </div>
                  <div className="truncate">
                    {t('evaluations.reportJsonPath')}:{' '}
                    {String(
                      item.scopeSummary?.reportJsonPath ??
                        item.counts?.replayReportJsonPath ??
                        'n/a'
                    )}
                  </div>
                  <div className="truncate">
                    {t('evaluations.workflowRunUrl')}:{' '}
                    {String(
                      (item.scopeSummary?.provenance as Record<string, unknown> | undefined)
                        ?.workflowRunUrl ?? 'n/a'
                    )}
                  </div>
                </div>
                {(item.failures?.length ?? 0) > 0 ? (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="font-medium">{t('evaluations.failures')}</div>
                    <div className="mt-1 space-y-1">
                      {item.failures?.slice(0, 4).map((failure) => (
                        <div key={failure}>{failure}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
