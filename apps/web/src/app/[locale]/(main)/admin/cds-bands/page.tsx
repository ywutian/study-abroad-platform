'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Database, RefreshCw, Save } from 'lucide-react';
import { adminRoutes } from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient, STALE_TIME } from '@/lib/api';
import { CdsBandCellMatrix } from './_components/cell-matrix';

interface CdsCoverageItem {
  schoolId: string;
  schoolName: string;
  schoolNameZh?: string | null;
  schoolNameNorm: string;
  usNewsRank?: number | null;
  acceptanceRate?: number | null;
  priority: boolean;
  cellCount: number;
  ready: boolean;
  latestCycleYear?: number | null;
  lastUpdatedAt?: string | null;
}

interface CdsCoverageResponse {
  generatedAt: string;
  totals: {
    schools: number;
    schoolsWithAnyCells: number;
    schoolsReady: number;
    prioritySchools: number;
    priorityReady: number;
    totalCells: number;
  };
  items: CdsCoverageItem[];
}

export interface CdsBandRow {
  id: string;
  schoolId: string;
  school: {
    id: string;
    name: string;
    nameZh?: string | null;
    usNewsRank?: number | null;
  };
  gpaBand: string;
  testType: string;
  testBand: string;
  admitRate: number;
  sampleCount?: number | null;
  cycleYear: number;
  source: string;
  sourceUrl?: string | null;
  updatedAt: string;
}

interface CdsRowsResponse {
  items: CdsBandRow[];
}

export default function AdminCdsBandsPage() {
  const t = useTranslations('admin.cdsBands');
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});

  const coverage = useQuery<CdsCoverageResponse>({
    queryKey: ['admin-cds-bands-coverage'],
    queryFn: () => apiClient.get(adminRoutes.predictionDistillationCdsBandsCoverage()),
    staleTime: STALE_TIME.MODERATE,
  });

  const rows = useQuery<CdsRowsResponse>({
    queryKey: ['admin-cds-bands-rows', selectedSchoolId, sourceFilter],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionDistillationCdsBandsRows(), {
        params: {
          schoolId: selectedSchoolId || undefined,
          source: sourceFilter || undefined,
          limit: 300,
        },
      }),
    staleTime: STALE_TIME.MODERATE,
  });

  const updateRow = useMutation({
    mutationFn: ({ id, admitRate }: { id: string; admitRate: number }) =>
      apiClient.patch(adminRoutes.predictionDistillationCdsBandsRow(id), {
        admitRate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cds-bands-rows'] });
      queryClient.invalidateQueries({ queryKey: ['admin-cds-bands-coverage'] });
    },
  });

  const priorityRows = useMemo(
    () => (coverage.data?.items ?? []).filter((item) => item.priority).slice(0, 30),
    [coverage.data?.items]
  );
  const selectedRows = rows.data?.items ?? [];
  const totals = coverage.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Database}
        color="emerald"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label={t('metrics.totalCells')} value={totals?.totalCells} />
        <MetricCard label={t('metrics.schoolsReady')} value={totals?.schoolsReady} />
        <MetricCard
          label={t('metrics.priorityReady')}
          value={totals ? `${totals.priorityReady}/${totals.prioritySchools}` : undefined}
        />
        <MetricCard label={t('metrics.schoolsWithAny')} value={totals?.schoolsWithAnyCells} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t('priorityTitle')}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                coverage.refetch();
                rows.refetch();
              }}
              disabled={coverage.isFetching || rows.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  coverage.isFetching || rows.isFetching ? 'animate-spin' : ''
                }`}
              />
              {t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {priorityRows.map((school) => (
              <button
                key={school.schoolId}
                className="flex items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted"
                onClick={() => setSelectedSchoolId(school.schoolId)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{school.schoolName}</span>
                  <span className="text-xs text-muted-foreground">
                    {school.latestCycleYear ?? t('noCycle')}
                  </span>
                </span>
                <Badge variant={school.ready ? 'default' : 'outline'}>{school.cellCount}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('rowsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={selectedSchoolId}
              onChange={(event) => setSelectedSchoolId(event.target.value)}
              placeholder={t('schoolIdPlaceholder')}
            />
            <Input
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              placeholder={t('sourcePlaceholder')}
            />
          </div>

          <CdsBandCellMatrix rows={selectedRows} />

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left">{t('table.school')}</th>
                  <th className="px-3 py-2 text-left">{t('table.gpaBand')}</th>
                  <th className="px-3 py-2 text-left">{t('table.test')}</th>
                  <th className="px-3 py-2 text-left">{t('table.rate')}</th>
                  <th className="px-3 py-2 text-left">{t('table.sample')}</th>
                  <th className="px-3 py-2 text-left">{t('table.source')}</th>
                  <th className="px-3 py-2 text-right">{t('table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row) => {
                  const editValue = editingRates[row.id] ?? String(row.admitRate);
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">{row.school.name}</td>
                      <td className="px-3 py-2">{row.gpaBand}</td>
                      <td className="px-3 py-2">
                        {row.testType} {row.testBand}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={editValue}
                          onChange={(event) =>
                            setEditingRates((prev) => ({
                              ...prev,
                              [row.id]: event.target.value,
                            }))
                          }
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="px-3 py-2">{row.sampleCount ?? '-'}</td>
                      <td className="max-w-72 truncate px-3 py-2">{row.source}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updateRow.isPending}
                          onClick={() =>
                            updateRow.mutate({
                              id: row.id,
                              admitRate: Number(editValue),
                            })
                          }
                        >
                          <Save className="mr-2 h-3.5 w-3.5" />
                          {t('save')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value ?? '-'}</p>
      </CardContent>
    </Card>
  );
}
