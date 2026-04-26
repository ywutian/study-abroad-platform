'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Play, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';

/**
 * Operational actions for the prediction data pipeline.
 *
 * Wraps the two admin endpoints — `cases/normalize-legacy` and
 * `cohort-priors/backfill` — so operators don't have to paste fetch()
 * into DevTools. Each action has a dry-run button and a live-run button;
 * the live-run asks for native confirm() before firing. Response is shown
 * inline with key counts + a scroll-box for the full JSON.
 *
 * Design decisions:
 *   - Native confirm() instead of a custom modal to keep the component
 *     self-contained (no new Dialog dep). Admin-only page; the default
 *     native prompt is sufficient for irreversible writes.
 *   - After a successful live write we invalidate the sibling inventory
 *     query (`admin-prediction-data-inventory`) so the row-count cards
 *     refresh without a manual page reload.
 */

type ActionId = 'normalize' | 'backfill' | 'cdsBands' | 'caseAggregates';

interface ActionResponse {
  [key: string]: unknown;
}

export function OperationalActionsCard() {
  const t = useTranslations('admin.predictionHealth.actions');
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<
    Record<ActionId, { dryRun: boolean; response: ActionResponse } | null>
  >({
    normalize: null,
    backfill: null,
    cdsBands: null,
    caseAggregates: null,
  });

  const normalize = useMutation({
    mutationFn: (dryRun: boolean) =>
      apiClient.post<ActionResponse>(adminRoutes.predictionWorkflowCasesNormalizeLegacy(), {
        dryRun,
      }),
    onSuccess: (response, dryRun) => {
      setLastResult((prev) => ({
        ...prev,
        normalize: { dryRun, response },
      }));
      if (!dryRun) {
        // The inventory dashboard reads from a different query key; force
        // a refresh so casesWithGpa11 + casesWithTestScores update.
        queryClient.invalidateQueries({
          queryKey: ['admin-prediction-data-inventory'],
        });
      }
    },
  });

  const backfill = useMutation({
    mutationFn: (dryRun: boolean) =>
      apiClient.post<ActionResponse>(adminRoutes.predictionWorkflowCohortPriorsBackfill(), {
        dryRun,
      }),
    onSuccess: (response, dryRun) => {
      setLastResult((prev) => ({
        ...prev,
        backfill: { dryRun, response },
      }));
      if (!dryRun) {
        queryClient.invalidateQueries({
          queryKey: ['admin-prediction-data-inventory'],
        });
      }
    },
  });

  // CDS Bands loader uses the bundled-fixture endpoint so the operator
  // doesn't need to paste 35 rows of JSON. For larger CDS sets use the
  // /cds-bands/load endpoint with a curated rows[] payload.
  const cdsBands = useMutation({
    mutationFn: (dryRun: boolean) =>
      apiClient.post<ActionResponse>(adminRoutes.predictionDistillationCdsBandsLoadFixture(), {
        dryRun,
      }),
    onSuccess: (response, dryRun) => {
      setLastResult((prev) => ({
        ...prev,
        cdsBands: { dryRun, response },
      }));
    },
  });

  const caseAggregates = useMutation({
    mutationFn: (dryRun: boolean) =>
      apiClient.post<ActionResponse>(adminRoutes.predictionDistillationCaseAggregatesBackfill(), {
        dryRun,
      }),
    onSuccess: (response, dryRun) => {
      setLastResult((prev) => ({
        ...prev,
        caseAggregates: { dryRun, response },
      }));
    },
  });

  const runLive = (
    action: ActionId,
    confirmKey:
      | 'normalize.confirmLive'
      | 'backfill.confirmLive'
      | 'cdsBands.confirmLive'
      | 'caseAggregates.confirmLive'
  ) => {
    if (!window.confirm(t(confirmKey))) return;
    if (action === 'normalize') normalize.mutate(false);
    else if (action === 'backfill') backfill.mutate(false);
    else if (action === 'cdsBands') cdsBands.mutate(false);
    else if (action === 'caseAggregates') caseAggregates.mutate(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <ActionBlock
            title={t('normalize.title')}
            subtitle={t('normalize.subtitle')}
            onDryRun={() => normalize.mutate(true)}
            onLive={() => runLive('normalize', 'normalize.confirmLive')}
            isLoading={normalize.isPending}
            error={normalize.error}
            result={lastResult.normalize}
            t={t}
          />
          <ActionBlock
            title={t('backfill.title')}
            subtitle={t('backfill.subtitle')}
            onDryRun={() => backfill.mutate(true)}
            onLive={() => runLive('backfill', 'backfill.confirmLive')}
            isLoading={backfill.isPending}
            error={backfill.error}
            result={lastResult.backfill}
            t={t}
          />
          <ActionBlock
            title={t('cdsBands.title')}
            subtitle={t('cdsBands.subtitle')}
            onDryRun={() => cdsBands.mutate(true)}
            onLive={() => runLive('cdsBands', 'cdsBands.confirmLive')}
            isLoading={cdsBands.isPending}
            error={cdsBands.error}
            result={lastResult.cdsBands}
            t={t}
          />
          <ActionBlock
            title={t('caseAggregates.title')}
            subtitle={t('caseAggregates.subtitle')}
            onDryRun={() => caseAggregates.mutate(true)}
            onLive={() => runLive('caseAggregates', 'caseAggregates.confirmLive')}
            isLoading={caseAggregates.isPending}
            error={caseAggregates.error}
            result={lastResult.caseAggregates}
            t={t}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------

function ActionBlock({
  title,
  subtitle,
  onDryRun,
  onLive,
  isLoading,
  error,
  result,
  t,
}: {
  title: string;
  subtitle: string;
  onDryRun: () => void;
  onLive: () => void;
  isLoading: boolean;
  error: unknown;
  result: { dryRun: boolean; response: ActionResponse } | null;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <h4 className="text-body-sm font-medium">{title}</h4>
        <p className="text-caption text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDryRun} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-2 h-3.5 w-3.5" />
          )}
          {t('dryRun')}
        </Button>
        <Button variant="default" size="sm" onClick={onLive} disabled={isLoading}>
          {t('live')}
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-body-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="break-words">{error instanceof Error ? error.message : t('error')}</span>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <Badge variant={result.dryRun ? 'outline' : 'default'}>
              {result.dryRun ? t('dryRunBadge') : t('liveBadge')}
            </Badge>
          </div>
          <ResultSummary result={result.response} t={t} />
          <details className="text-caption">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              {t('fullJson')}
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-caption font-mono max-h-80 overflow-y-auto">
              {JSON.stringify(result.response, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pulls the 3-4 most interesting counters out of a response for inline
 * display. We read loosely by key lookup — the two endpoints share most
 * of the useful shape (counts under `scanned` / `written` / `updated` /
 * `eligibleBuckets` etc.) so a single summary renderer covers both.
 */
function ResultSummary({
  result,
  t,
}: {
  result: ActionResponse;
  t: ReturnType<typeof useTranslations>;
}) {
  const rows: Array<{ label: string; value: string | number }> = [];
  const push = (label: string, value: unknown) => {
    if (value == null) return;
    if (typeof value === 'number' || typeof value === 'string') {
      rows.push({ label, value });
    }
  };

  push(t('result.scanned'), result.scanned);
  push(t('result.written'), result.written);
  push(t('result.updated'), result.updated);
  push(t('result.created'), result.created); // CDS bands ingestion
  push(t('result.valid'), result.valid); // CDS bands ingestion
  push(t('result.deleted'), result.deleted); // case-aggregate replace step
  push(t('result.gpaWritten'), result.gpaWritten);
  push(t('result.testScoresWritten'), result.testScoresWritten);
  push(t('result.eligibleBuckets'), result.eligibleBuckets);
  push(t('result.droppedLowSample'), result.droppedLowSample);

  // Per-teacher tally surfaces from the case-aggregate response so the
  // operator immediately sees which case-driven teachers actually have
  // coverage (a teacher with 0 here means its underlying field is sparse).
  if (result.eligibleByTeacher && typeof result.eligibleByTeacher === 'object') {
    for (const [teacherKey, count] of Object.entries(
      result.eligibleByTeacher as Record<string, number>
    )) {
      rows.push({ label: teacherKey, value: count });
    }
  }

  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-mono">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
