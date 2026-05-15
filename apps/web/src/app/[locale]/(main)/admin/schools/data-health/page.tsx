'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { BarChart3, RefreshCw, Pencil } from 'lucide-react';
import { adminRoutes } from '@study-abroad/shared';
import { PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient, STALE_TIME } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

type FocusOption = 'all' | 'intl' | 'rounds' | 'academic';

interface GapField {
  field: string;
  bucket: 'missing' | 'heuristic' | 'stale';
  weight: number;
}

interface DataHealthRow {
  schoolId: string;
  schoolName: string;
  schoolNameZh: string | null;
  usNewsRank: number | null;
  country: string;
  state: string | null;
  gapFields: GapField[];
  importanceWeight: number;
  gapWeight: number;
  priorityScore: number;
}

interface DataHealthDashboard {
  generatedAt: string;
  focus: FocusOption;
  totalSchoolsConsidered: number;
  rowsReturned: number;
  rows: DataHealthRow[];
  totalsByField: Array<{
    field: string;
    missing: number;
    heuristic: number;
    stale: number;
    terminal: number;
    official: number;
  }>;
}

const FOCUS_OPTIONS: ReadonlyArray<FocusOption> = ['all', 'intl', 'rounds', 'academic'];

function bucketColor(bucket: GapField['bucket']) {
  // Static class maps so Tailwind purge keeps them.
  switch (bucket) {
    case 'missing':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
    case 'heuristic':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
    case 'stale':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
  }
}

export default function DataHealthPage() {
  const t = useTranslations('admin.dataHealth');
  const queryClient = useQueryClient();
  const [focus, setFocus] = useState<FocusOption>('intl');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'schools', 'data-health', focus],
    queryFn: () =>
      apiClient.get<DataHealthDashboard>(
        `${adminRoutes.schoolsDataHealth()}?focus=${focus}&limit=100`
      ),
    staleTime: STALE_TIME.MODERATE,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['admin', 'schools', 'data-health'],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title={t('title')}
        description={t('description')}
        color="amber"
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            {t('refresh')}
          </Button>
        }
      />

      <Tabs value={focus} onValueChange={(v) => setFocus(v as FocusOption)}>
        <TabsList>
          {FOCUS_OPTIONS.map((f) => (
            <TabsTrigger key={f} value={f}>
              {t(`focus.${f}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('loading')}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="py-12 text-center text-rose-600 dark:text-rose-400">
            {t('error')}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t('totalSchoolsConsidered')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.totalSchoolsConsidered}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t('rowsReturned')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{data.rowsReturned}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('totalsHeader')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.gaps')}</TableHead>
                      <TableHead>{t('totals.missing')}</TableHead>
                      <TableHead>{t('totals.heuristic')}</TableHead>
                      <TableHead>{t('totals.stale')}</TableHead>
                      <TableHead>{t('totals.terminal')}</TableHead>
                      <TableHead>{t('totals.official')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.totalsByField.map((row) => (
                      <TableRow key={row.field}>
                        <TableCell className="font-mono text-xs">{row.field}</TableCell>
                        <TableCell>{row.missing}</TableCell>
                        <TableCell>{row.heuristic}</TableCell>
                        <TableCell>{row.stale}</TableCell>
                        <TableCell className="text-muted-foreground">{row.terminal}</TableCell>
                        <TableCell className="text-emerald-700 dark:text-emerald-400">
                          {row.official}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t('table.rank')}</TableHead>
                    <TableHead>{t('table.school')}</TableHead>
                    <TableHead>{t('table.gaps')}</TableHead>
                    <TableHead className="w-32">{t('table.importance')}</TableHead>
                    <TableHead className="w-32">{t('table.score')}</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.schoolId}>
                      <TableCell>
                        {row.usNewsRank != null ? (
                          <Badge variant="secondary">#{row.usNewsRank}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t('rankBadgeUnranked')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.schoolName}</div>
                        {row.schoolNameZh && (
                          <div className="text-xs text-muted-foreground">{row.schoolNameZh}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.gapFields.map((g) => (
                            <span
                              key={g.field}
                              className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${bucketColor(g.bucket)}`}
                            >
                              <span className="font-mono">{g.field}</span>
                              <span className="ml-1 opacity-70">
                                · {t(`gapBucket.${g.bucket}`)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ×{row.importanceWeight}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {row.priorityScore.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/schools?edit=${row.schoolId}`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
