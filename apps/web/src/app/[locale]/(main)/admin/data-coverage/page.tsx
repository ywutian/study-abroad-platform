'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { BarChart3, RefreshCw, PencilLine } from 'lucide-react';
import { adminRoutes } from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, STALE_TIME } from '@/lib/api';

interface CoverageField {
  field: string;
  value: unknown;
  filled: boolean;
  explicitUnknown: boolean;
  source: string | null;
  tier: string | null;
  confidence: number | null;
  sourceUrl?: string | null;
  cycleYear?: number | null;
  validatorCount?: number | null;
  originalFormula?: string | null;
  realDataStatus?: string | null;
  terminalStatus?: string | null;
  reason?: string | null;
  staleness: string | null;
  predictionEligible: boolean;
  isOfficial: boolean;
  isHeuristic: boolean;
  isTerminal: boolean;
  bucket: 'official' | 'heuristic' | 'terminal' | 'stale' | 'other' | 'missing';
}

interface CoverageItem {
  schoolId: string;
  schoolName: string;
  schoolNameZh?: string | null;
  usNewsRank?: number | null;
  criticalComplete: boolean;
  missingCritical: string[];
  heuristicCritical: string[];
  terminalCritical: string[];
  staleCritical: string[];
  campusLifeComplete?: boolean;
  missingCampusLife?: string[];
  terminalCampusLife?: string[];
  staleCampusLife?: string[];
  fields: CoverageField[];
  campusLifeFields?: CoverageField[];
}

interface CoverageFieldTotal {
  total: number;
  filled: number;
  percent: number;
  predictionEligible: number;
  predictionEligiblePercent: number;
  official: number;
  heuristic: number;
  terminal: number;
  stale: number;
}

type CoverageFieldTotals = Record<string, CoverageFieldTotal>;

interface CoverageResponse {
  generatedAt: string;
  criticalFields: string[];
  optionalFields: string[];
  campusLifeFields?: string[];
  campusLifeSummary?: {
    totalSchools: number;
    complete: number;
    missingAny: number;
    terminalSchools: number;
    staleSchools: number;
    filledFields: number;
    terminalFields: number;
    missingFields: number;
  };
  totals: {
    schools: number;
    criticalComplete: number;
    missingAnyCritical: number;
    heuristicOnlySchools: number;
    terminalStatusSchools: number;
    staleCriticalSchools: number;
    officialFields: number;
    heuristicFields: number;
    terminalFields: number;
    staleFields: number;
  };
  fieldTotals: CoverageFieldTotals;
  campusLifeTotals?: CoverageFieldTotals;
  bucketCounts: Record<string, number>;
  items: CoverageItem[];
}

export default function AdminDataCoveragePage() {
  const t = useTranslations('admin.dataCoverage');
  const queryClient = useQueryClient();
  const coverage = useQuery<CoverageResponse>({
    queryKey: ['admin-school-data-coverage'],
    queryFn: () => apiClient.get(adminRoutes.schoolsDataCoverage()),
    staleTime: STALE_TIME.MODERATE,
  });

  const heuristicFill = useMutation({
    mutationFn: (dryRun: boolean) =>
      apiClient.post(adminRoutes.schoolsHeuristicFill(), {
        dryRun,
        limit: 500,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-school-data-coverage'] });
    },
  });

  const rows = useMemo(() => coverage.data?.items ?? [], [coverage.data?.items]);
  const problemRows = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            !row.criticalComplete ||
            (row.heuristicCritical ?? []).length > 0 ||
            (row.terminalCritical ?? []).length > 0 ||
            (row.staleCritical ?? []).length > 0
        )
        .slice(0, 80),
    [rows]
  );
  const totals = coverage.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={BarChart3}
        color="emerald"
      />

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-6">
        <MetricCard label={t('metrics.schools')} value={totals?.schools} />
        <MetricCard label={t('metrics.complete')} value={totals?.criticalComplete} />
        <MetricCard label={t('metrics.missing')} value={totals?.missingAnyCritical} />
        <MetricCard label={t('metrics.heuristic')} value={totals?.heuristicFields} />
        <MetricCard label={t('metrics.official')} value={totals?.officialFields} />
        <MetricCard label={t('metrics.terminal')} value={totals?.terminalFields} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t('fieldCoverage')}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => coverage.refetch()}
                disabled={coverage.isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${coverage.isFetching ? 'animate-spin' : ''}`}
                />
                {t('refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => heuristicFill.mutate(true)}
                disabled={heuristicFill.isPending}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {t('dryRunHeuristic')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table.field')}</th>
                  <th className="px-3 py-2 text-right">{t('table.filled')}</th>
                  <th className="px-3 py-2 text-right">{t('table.official')}</th>
                  <th className="px-3 py-2 text-right">{t('table.eligible')}</th>
                  <th className="px-3 py-2 text-right">{t('table.heuristic')}</th>
                  <th className="px-3 py-2 text-right">{t('table.terminal')}</th>
                  <th className="px-3 py-2 text-right">{t('table.stale')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(coverage.data?.fieldTotals ?? {}).map(([field, total]) => (
                  <tr key={field} className="border-t">
                    <td className="px-3 py-2 font-medium">{field}</td>
                    <td className="px-3 py-2 text-right">
                      {total.filled}/{total.total} ({total.percent}%)
                    </td>
                    <td className="px-3 py-2 text-right">{total.official}</td>
                    <td className="px-3 py-2 text-right">{total.predictionEligiblePercent}%</td>
                    <td className="px-3 py-2 text-right">{total.heuristic}</td>
                    <td className="px-3 py-2 text-right">{total.terminal}</td>
                    <td className="px-3 py-2 text-right">{total.stale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {heuristicFill.data ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(heuristicFill.data, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('campusLifeCoverage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard
              label={t('metrics.complete')}
              value={coverage.data?.campusLifeSummary?.complete}
            />
            <MetricCard
              label={t('metrics.missing')}
              value={coverage.data?.campusLifeSummary?.missingAny}
            />
            <MetricCard
              label={t('metrics.terminal')}
              value={coverage.data?.campusLifeSummary?.terminalFields}
            />
            <MetricCard
              label={t('metrics.missingFields')}
              value={coverage.data?.campusLifeSummary?.missingFields}
            />
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table.field')}</th>
                  <th className="px-3 py-2 text-right">{t('table.filled')}</th>
                  <th className="px-3 py-2 text-right">{t('table.official')}</th>
                  <th className="px-3 py-2 text-right">{t('table.terminal')}</th>
                  <th className="px-3 py-2 text-right">{t('table.stale')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(coverage.data?.campusLifeTotals ?? {}).map(([field, total]) => (
                  <tr key={field} className="border-t">
                    <td className="px-3 py-2 font-medium">{field}</td>
                    <td className="px-3 py-2 text-right">
                      {total.filled}/{total.total} ({total.percent}%)
                    </td>
                    <td className="px-3 py-2 text-right">{total.official}</td>
                    <td className="px-3 py-2 text-right">{total.terminal}</td>
                    <td className="px-3 py-2 text-right">{total.stale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('schoolsNeedingWork')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table.school')}</th>
                  <th className="px-3 py-2 text-left">{t('table.missing')}</th>
                  <th className="px-3 py-2 text-left">{t('table.qualityFields')}</th>
                  <th className="px-3 py-2 text-left">{t('table.sources')}</th>
                </tr>
              </thead>
              <tbody>
                {problemRows.map((row) => (
                  <tr key={row.schoolId} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.schoolName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.usNewsRank ? `#${row.usNewsRank}` : row.schoolId}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.criticalComplete ? 'secondary' : 'destructive'}>
                        {(row.missingCritical ?? []).length
                          ? (row.missingCritical ?? []).join(', ')
                          : t('none')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1 text-xs">
                        <FieldList
                          label={t('table.heuristic')}
                          fields={row.heuristicCritical ?? []}
                        />
                        <FieldList
                          label={t('table.terminal')}
                          fields={row.terminalCritical ?? []}
                        />
                        <FieldList label={t('table.stale')} fields={row.staleCritical ?? []} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-2">
                        {(row.fields ?? [])
                          .filter((field) => field.filled || field.isTerminal)
                          .slice(0, 10)
                          .map((field) => (
                            <div key={field.field} className="rounded-md border bg-background p-2">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant={field.isOfficial ? 'secondary' : 'outline'}>
                                  {field.field}: {field.bucket}
                                </Badge>
                                {field.cycleYear ? (
                                  <Badge variant="outline">{field.cycleYear}</Badge>
                                ) : null}
                                {field.validatorCount ? (
                                  <Badge variant="outline">
                                    {t('table.validators', {
                                      count: field.validatorCount,
                                    })}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                <div>{field.source ?? field.realDataStatus ?? t('unknown')}</div>
                                {field.sourceUrl ? (
                                  <a
                                    href={field.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    {field.sourceUrl}
                                  </a>
                                ) : null}
                                {field.originalFormula ? <div>{field.originalFormula}</div> : null}
                                {field.reason ? <div>{field.reason}</div> : null}
                              </div>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value?: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value ?? '-'}</div>
      </CardContent>
    </Card>
  );
}

function FieldList({ label, fields }: { label: string; fields: string[] }) {
  if (fields.length === 0) return null;
  return (
    <div>
      <span className="font-medium">{label}: </span>
      <span>{fields.join(', ')}</span>
    </div>
  );
}
