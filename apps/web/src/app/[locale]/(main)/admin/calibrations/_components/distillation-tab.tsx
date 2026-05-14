'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Database, ShieldCheck, Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { adminRoutes } from '@study-abroad/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';

type DistillationOverview = {
  latestDate: string | null;
  teacherStats: Array<{
    id: string;
    date: string;
    stage: string;
    teacherKey: string;
    cohortKey: string;
    predictionCount: number;
    activeSignalCount: number;
    resolvedOutcomeCount: number;
    avgTeacherProbability: number | null;
    avgObservedWeight: number | null;
    brierTeacher: number | null;
    brierBlended: number | null;
    brierServed: number | null;
    distinctSchoolCount: number;
  }>;
  schoolCoverage: Array<{
    stage: string;
    coverageTier: string;
    predictionCount: number;
    schoolCount: number;
  }>;
  chinaGates: Array<{
    cohortKey: string;
    eligible: boolean;
    resolvedOutcomeCount: number;
    top100CoverageRate: number;
    brierBlended: number | null;
    brierServed: number | null;
    reasons: string[];
  }>;
};

type DistillationSchoolRow = {
  id: string;
  schoolId: string;
  cohortKey: string;
  stage: string;
  coverageTier: string;
  predictionCount: number;
  resolvedOutcomeCount: number;
  avgBlendDelta: number | null;
  avgAbsBlendDelta: number | null;
  brierBlended: number | null;
  brierServed: number | null;
  school: {
    id: string;
    name: string;
    nameZh: string | null;
    usNewsRank: number | null;
  };
};

function formatPct(value: number | null | undefined) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toFixed(4);
}

export function DistillationTab() {
  const t = useTranslations('admin.calibrations.distillation');

  const overviewQuery = useQuery<DistillationOverview>({
    queryKey: ['adminDistillationOverview'],
    queryFn: () => apiClient.get(adminRoutes.predictionsDistillationOverview()),
  });

  const schoolsQuery = useQuery<DistillationSchoolRow[]>({
    queryKey: ['adminDistillationSchools'],
    queryFn: () =>
      apiClient.get(adminRoutes.predictionsDistillationSchools(), {
        params: {
          limit: 25,
        },
      }),
  });

  if (overviewQuery.isLoading || schoolsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const overview = overviewQuery.data;
  const schools = schoolsQuery.data ?? [];
  const teacherStats = overview?.teacherStats ?? [];
  const schoolCoverage = overview?.schoolCoverage ?? [];
  const chinaGates = overview?.chinaGates ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teacherStats.length}</p>
                <p className="text-sm text-muted-foreground">{t('stats.teacherRows')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{schoolCoverage.length}</p>
                <p className="text-sm text-muted-foreground">{t('stats.coverageRows')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <Lightbulb className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {overview?.latestDate ? new Date(overview.latestDate).toLocaleDateString() : '—'}
                </p>
                <p className="text-sm text-muted-foreground">{t('stats.latestRollupDate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {chinaGates.filter((gate) => gate.eligible).length}/{chinaGates.length}
                </p>
                <p className="text-sm text-muted-foreground">{t('stats.chinaCohortsReady')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('chinaGates.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('chinaGates.cohort')}</TableHead>
                <TableHead>{t('chinaGates.status')}</TableHead>
                <TableHead>{t('chinaGates.resolvedOutcomes')}</TableHead>
                <TableHead>{t('chinaGates.top100Coverage')}</TableHead>
                <TableHead>{t('chinaGates.brierBlended')}</TableHead>
                <TableHead>{t('chinaGates.brierServed')}</TableHead>
                <TableHead>{t('chinaGates.blockers')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chinaGates.map((gate) => (
                <TableRow key={gate.cohortKey}>
                  <TableCell>{gate.cohortKey}</TableCell>
                  <TableCell>
                    {gate.eligible ? t('chinaGates.ready') : t('chinaGates.blocked')}
                  </TableCell>
                  <TableCell>{gate.resolvedOutcomeCount}</TableCell>
                  <TableCell>{formatPct(gate.top100CoverageRate)}</TableCell>
                  <TableCell>{formatScore(gate.brierBlended)}</TableCell>
                  <TableCell>{formatScore(gate.brierServed)}</TableCell>
                  <TableCell>{gate.reasons.length ? gate.reasons.join(', ') : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('teacherStats.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('teacherStats.teacher')}</TableHead>
                <TableHead>{t('teacherStats.cohort')}</TableHead>
                <TableHead>{t('teacherStats.stage')}</TableHead>
                <TableHead>{t('teacherStats.predictions')}</TableHead>
                <TableHead>{t('teacherStats.activeSignals')}</TableHead>
                <TableHead>{t('teacherStats.avgWeight')}</TableHead>
                <TableHead>{t('teacherStats.brierTeacher')}</TableHead>
                <TableHead>{t('teacherStats.brierBlended')}</TableHead>
                <TableHead>{t('teacherStats.brierServed')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teacherStats.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.teacherKey}</TableCell>
                  <TableCell>{row.cohortKey}</TableCell>
                  <TableCell>{row.stage}</TableCell>
                  <TableCell>{row.predictionCount}</TableCell>
                  <TableCell>{row.activeSignalCount}</TableCell>
                  <TableCell>{formatPct(row.avgObservedWeight)}</TableCell>
                  <TableCell>{formatScore(row.brierTeacher)}</TableCell>
                  <TableCell>{formatScore(row.brierBlended)}</TableCell>
                  <TableCell>{formatScore(row.brierServed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('schools.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('schools.school')}</TableHead>
                <TableHead>{t('schools.cohort')}</TableHead>
                <TableHead>{t('schools.coverageTier')}</TableHead>
                <TableHead>{t('schools.predictions')}</TableHead>
                <TableHead>{t('schools.resolved')}</TableHead>
                <TableHead>{t('schools.avgAbsDelta')}</TableHead>
                <TableHead>{t('schools.brierBlended')}</TableHead>
                <TableHead>{t('schools.brierServed')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.school.nameZh || row.school.name}
                    {row.school.usNewsRank ? ` (#${row.school.usNewsRank})` : ''}
                  </TableCell>
                  <TableCell>{row.cohortKey}</TableCell>
                  <TableCell>{row.coverageTier}</TableCell>
                  <TableCell>{row.predictionCount}</TableCell>
                  <TableCell>{row.resolvedOutcomeCount}</TableCell>
                  <TableCell>{formatPct(row.avgAbsBlendDelta)}</TableCell>
                  <TableCell>{formatScore(row.brierBlended)}</TableCell>
                  <TableCell>{formatScore(row.brierServed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
