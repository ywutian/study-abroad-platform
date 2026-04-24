'use client';

import { useQueries } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { apiClient, STALE_TIME } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';

// -----------------------------------------------------------------------------
// Types mirror the service return shapes defined in
// apps/api/src/modules/prediction/prediction-workflow.service.ts
// (getAuthorityStats / getDataInventory / getTrainingReadiness). Kept local
// because these are admin diagnostics and don't merit a shared DTO yet.
// -----------------------------------------------------------------------------

type AuthorityBuckets = {
  total: number;
  AUTHORITATIVE: number;
  PREVIEW: number;
  NULL: number;
};

type AuthorityStats = {
  result: AuthorityBuckets;
  snapshot: AuthorityBuckets;
  invariantChecks: {
    resultNullCount: number;
    snapshotNullCount: number;
    previewRowsWithOutcomeLabel: number;
  };
  generatedAt: string;
};

type DataInventory = {
  schools: {
    total: number;
    withSat: number;
    withAdmitRate: number;
    withBoth: number;
    scorecardReady: number;
  };
  schoolPrograms: { total: number; withAcceptanceRateEstimate: number };
  schoolCalibrations: { total: number };
  teacherSignalTables: {
    cohortRoundPriors: number;
    cohortRegimeSignals: number;
    relationshipSignals: number;
  };
  admissionCases: {
    total: number;
    verified: number;
    approvedForTeacher: number;
    byResult: Record<string, number>;
    withGpa11: number;
    withTestScores: number;
  };
  schoolMetrics: { total: number; distinctKeys: string[] };
  generatedAt: string;
};

type TrainingReadiness = {
  totalLabeled: number;
  breakdown: {
    verifiedOutcomeLabels: number;
    approvedAdmissionCases: number;
    casesWithStructuredTestScores: number;
  };
  tier: {
    current: number;
    currentLabel: string;
    next: { tier: number; label: string; samplesNeeded: number } | null;
    thresholds: Array<{ tier: number; min: number; label: string }>;
  };
  perSchoolCoverage: {
    schoolsWithAtLeast10Samples: number;
    schoolsWithAtLeast20Samples: number;
    schoolsWithAtLeast50Samples: number;
    schoolsWithAtLeast100Samples: number;
    totalSchoolsWithAnySample: number;
  };
  yearBreakdown: Record<string, number>;
  recommendedNextAction: string;
  generatedAt: string;
};

function formatNumber(n: number | undefined | null): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

export default function AdminPredictionHealthPage() {
  const t = useTranslations('admin.predictionHealth');

  const [authorityQ, inventoryQ, readinessQ] = useQueries({
    queries: [
      {
        queryKey: ['admin-prediction-authority-stats'],
        queryFn: () =>
          apiClient.get<AuthorityStats>(adminRoutes.predictionWorkflowAuthorityStats()),
        staleTime: STALE_TIME.STATIC,
      },
      {
        queryKey: ['admin-prediction-data-inventory'],
        queryFn: () => apiClient.get<DataInventory>(adminRoutes.predictionWorkflowDataInventory()),
        staleTime: STALE_TIME.STATIC,
      },
      {
        queryKey: ['admin-prediction-training-readiness'],
        queryFn: () =>
          apiClient.get<TrainingReadiness>(adminRoutes.predictionWorkflowTrainingReadiness()),
        staleTime: STALE_TIME.STATIC,
      },
    ],
  });

  const anyLoading = authorityQ.isLoading || inventoryQ.isLoading || readinessQ.isLoading;
  const anyError = authorityQ.error || inventoryQ.error || readinessQ.error;

  const refetchAll = () => {
    authorityQ.refetch();
    inventoryQ.refetch();
    readinessQ.refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Activity}
        color="indigo"
      />

      <div className="flex items-center justify-end gap-3">
        {authorityQ.data?.generatedAt ? (
          <span className="text-caption text-muted-foreground">
            {t('lastUpdated')}: {new Date(authorityQ.data.generatedAt).toLocaleString()}
          </span>
        ) : null}
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={anyLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${anyLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {anyError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive text-body-sm">{t('loadFailed')}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Card 1: Authority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>{t('authority.title')}</CardTitle>
          <CardDescription>{t('authority.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {authorityQ.isLoading ? (
            <p className="text-body-sm text-muted-foreground">{t('loading')}</p>
          ) : authorityQ.data ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <AuthorityBucketCard
                  label={t('authority.resultsTable')}
                  buckets={authorityQ.data.result}
                  t={t}
                />
                <AuthorityBucketCard
                  label={t('authority.snapshotsTable')}
                  buckets={authorityQ.data.snapshot}
                  t={t}
                />
              </div>
              <div>
                <h4 className="text-body-sm font-medium mb-2">{t('authority.invariantChecks')}</h4>
                <ul className="space-y-1">
                  <InvariantRow
                    okLabel={t('authority.resultNullOk')}
                    violatedLabel={t('authority.resultNullViolated', {
                      count: authorityQ.data.invariantChecks.resultNullCount,
                    })}
                    violated={authorityQ.data.invariantChecks.resultNullCount > 0}
                  />
                  <InvariantRow
                    okLabel={t('authority.snapshotNullOk')}
                    violatedLabel={t('authority.snapshotNullViolated', {
                      count: authorityQ.data.invariantChecks.snapshotNullCount,
                    })}
                    violated={authorityQ.data.invariantChecks.snapshotNullCount > 0}
                  />
                  <InvariantRow
                    okLabel={t('authority.previewWithOutcomeOk')}
                    violatedLabel={t('authority.previewWithOutcomeViolated', {
                      count: authorityQ.data.invariantChecks.previewRowsWithOutcomeLabel,
                    })}
                    violated={authorityQ.data.invariantChecks.previewRowsWithOutcomeLabel > 0}
                  />
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Card 2: Data Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.title')}</CardTitle>
          <CardDescription>{t('inventory.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryQ.isLoading ? (
            <p className="text-body-sm text-muted-foreground">{t('loading')}</p>
          ) : inventoryQ.data ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="text-body-sm font-medium mb-2">{t('inventory.schools')}</h4>
                <StatList
                  rows={[
                    {
                      label: t('inventory.schoolsTotal'),
                      value: inventoryQ.data.schools.total,
                    },
                    {
                      label: t('inventory.schoolsWithSat'),
                      value: inventoryQ.data.schools.withSat,
                    },
                    {
                      label: t('inventory.schoolsWithAdmitRate'),
                      value: inventoryQ.data.schools.withAdmitRate,
                    },
                    {
                      label: t('inventory.scorecardReady'),
                      value: inventoryQ.data.schools.scorecardReady,
                      highlight: true,
                    },
                  ]}
                />
              </div>

              <div>
                <h4 className="text-body-sm font-medium mb-2">{t('inventory.schoolPrograms')}</h4>
                <StatList
                  rows={[
                    {
                      label: t('inventory.casesTotal'),
                      value: inventoryQ.data.schoolPrograms.total,
                    },
                    {
                      label: t('inventory.withAcceptanceRate'),
                      value: inventoryQ.data.schoolPrograms.withAcceptanceRateEstimate,
                    },
                  ]}
                />
                <h4 className="text-body-sm font-medium mb-2 mt-4">
                  {t('inventory.schoolCalibrations')}
                </h4>
                <StatList
                  rows={[
                    {
                      label: t('inventory.casesTotal'),
                      value: inventoryQ.data.schoolCalibrations.total,
                    },
                  ]}
                />
              </div>

              <div>
                <h4 className="text-body-sm font-medium mb-2">{t('inventory.teacherSignals')}</h4>
                <StatList
                  rows={[
                    {
                      label: t('inventory.cohortPriors'),
                      value: inventoryQ.data.teacherSignalTables.cohortRoundPriors,
                      emptyWarn: true,
                    },
                    {
                      label: t('inventory.regimeSignals'),
                      value: inventoryQ.data.teacherSignalTables.cohortRegimeSignals,
                      emptyWarn: true,
                    },
                    {
                      label: t('inventory.relationshipSignals'),
                      value: inventoryQ.data.teacherSignalTables.relationshipSignals,
                      emptyWarn: true,
                    },
                  ]}
                />
                <h4 className="text-body-sm font-medium mb-2 mt-4">
                  {t('inventory.schoolMetrics')}
                </h4>
                <StatList
                  rows={[
                    {
                      label: t('inventory.casesTotal'),
                      value: inventoryQ.data.schoolMetrics.total,
                    },
                    {
                      label: t('inventory.distinctKeys'),
                      value: inventoryQ.data.schoolMetrics.distinctKeys.length || 0,
                    },
                  ]}
                />
              </div>

              <div>
                <h4 className="text-body-sm font-medium mb-2">{t('inventory.admissionCases')}</h4>
                <StatList
                  rows={[
                    {
                      label: t('inventory.casesTotal'),
                      value: inventoryQ.data.admissionCases.total,
                    },
                    {
                      label: t('inventory.casesVerified'),
                      value: inventoryQ.data.admissionCases.verified,
                    },
                    {
                      label: t('inventory.casesApproved'),
                      value: inventoryQ.data.admissionCases.approvedForTeacher,
                      highlight: true,
                    },
                    {
                      label: t('inventory.casesWithGpa11'),
                      value: inventoryQ.data.admissionCases.withGpa11,
                    },
                    {
                      label: t('inventory.casesWithTestScores'),
                      value: inventoryQ.data.admissionCases.withTestScores,
                    },
                  ]}
                />
                {Object.keys(inventoryQ.data.admissionCases.byResult).length > 0 ? (
                  <div className="mt-3">
                    <h5 className="text-caption text-muted-foreground mb-1">
                      {t('inventory.casesByResult')}
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(inventoryQ.data.admissionCases.byResult).map(
                        ([result, count]) => (
                          <Badge key={result} variant="outline">
                            {result}: {formatNumber(count)}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Card 3: Training Readiness */}
      <Card>
        <CardHeader>
          <CardTitle>{t('training.title')}</CardTitle>
          <CardDescription>{t('training.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {readinessQ.isLoading ? (
            <p className="text-body-sm text-muted-foreground">{t('loading')}</p>
          ) : readinessQ.data ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-body-sm font-medium mb-2">{t('training.totalLabeled')}</h4>
                  <p className="text-3xl font-bold">{formatNumber(readinessQ.data.totalLabeled)}</p>
                  <StatList
                    rows={[
                      {
                        label: t('training.verifiedLabels'),
                        value: readinessQ.data.breakdown.verifiedOutcomeLabels,
                      },
                      {
                        label: t('training.approvedCases'),
                        value: readinessQ.data.breakdown.approvedAdmissionCases,
                      },
                      {
                        label: t('training.withStructuredScores'),
                        value: readinessQ.data.breakdown.casesWithStructuredTestScores,
                      },
                    ]}
                  />
                </div>

                <div>
                  <h4 className="text-body-sm font-medium mb-2">{t('training.currentTier')}</h4>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge
                      variant={readinessQ.data.tier.current >= 2 ? 'default' : 'outline'}
                      className="text-base px-3 py-1"
                    >
                      Tier {readinessQ.data.tier.current}
                    </Badge>
                    <span className="text-body-sm text-muted-foreground">
                      {readinessQ.data.tier.currentLabel}
                    </span>
                  </div>
                  {readinessQ.data.tier.next ? (
                    <p className="text-caption text-muted-foreground">
                      {t('training.nextTier')}: Tier {readinessQ.data.tier.next.tier} (
                      {readinessQ.data.tier.next.label}) — {t('training.samplesNeeded')}:{' '}
                      <span className="font-mono text-foreground">
                        {formatNumber(readinessQ.data.tier.next.samplesNeeded)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <h4 className="text-body-sm font-medium mb-2">{t('training.perSchoolCoverage')}</h4>
                <p className="text-caption text-muted-foreground mb-2">
                  {t('training.schoolsWithSamples', {
                    count: readinessQ.data.perSchoolCoverage.totalSchoolsWithAnySample,
                  })}
                </p>
                <div className="grid gap-2 md:grid-cols-4">
                  <CoverageCell
                    label={t('training.atLeast10')}
                    value={readinessQ.data.perSchoolCoverage.schoolsWithAtLeast10Samples}
                  />
                  <CoverageCell
                    label={t('training.atLeast20')}
                    value={readinessQ.data.perSchoolCoverage.schoolsWithAtLeast20Samples}
                  />
                  <CoverageCell
                    label={t('training.atLeast50')}
                    value={readinessQ.data.perSchoolCoverage.schoolsWithAtLeast50Samples}
                  />
                  <CoverageCell
                    label={t('training.atLeast100')}
                    value={readinessQ.data.perSchoolCoverage.schoolsWithAtLeast100Samples}
                  />
                </div>
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                <h4 className="text-body-sm font-medium mb-1">{t('training.recommendation')}</h4>
                <p className="text-body-sm">{readinessQ.data.recommendedNextAction}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------

function AuthorityBucketCard({
  label,
  buckets,
  t,
}: {
  label: string;
  buckets: AuthorityBuckets;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-body-sm font-medium">{label}</h4>
        <span className="text-caption text-muted-foreground">
          {t('authority.total')}: {formatNumber(buckets.total)}
        </span>
      </div>
      <div className="space-y-2">
        <StatList
          rows={[
            {
              label: t('authority.authoritative'),
              value: buckets.AUTHORITATIVE,
              highlight: true,
            },
            {
              label: t('authority.preview'),
              value: buckets.PREVIEW,
            },
            {
              label: t('authority.nullCount'),
              value: buckets.NULL,
              emptyWarn: false,
              warnIfNonZero: true,
            },
          ]}
        />
      </div>
    </div>
  );
}

function StatList({
  rows,
}: {
  rows: Array<{
    label: string;
    value: number;
    highlight?: boolean;
    emptyWarn?: boolean;
    warnIfNonZero?: boolean;
  }>;
}) {
  return (
    <dl className="space-y-1">
      {rows.map((row) => {
        const isWarn = (row.emptyWarn && row.value === 0) || (row.warnIfNonZero && row.value > 0);
        return (
          <div key={row.label} className="flex items-center justify-between text-body-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd
              className={
                isWarn
                  ? 'font-mono font-medium text-amber-600 dark:text-amber-400'
                  : row.highlight
                    ? 'font-mono font-medium text-foreground'
                    : 'font-mono text-foreground'
              }
            >
              {formatNumber(row.value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function CoverageCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border p-2 text-center">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="text-xl font-bold font-mono">{formatNumber(value)}</div>
    </div>
  );
}

function InvariantRow({
  okLabel,
  violatedLabel,
  violated,
}: {
  okLabel: string;
  violatedLabel: string;
  violated: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-body-sm">
      {violated ? (
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      )}
      <span className={violated ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
        {violated ? violatedLabel : okLabel}
      </span>
    </li>
  );
}
