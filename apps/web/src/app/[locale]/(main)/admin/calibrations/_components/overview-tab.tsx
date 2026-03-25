'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Target, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { getSchoolName } from '@/lib/utils';

import { CalibrationFormDialog } from './calibration-form-dialog';

interface CalibrationStats {
  totalCalibrations: number;
  averageMultiplier: number;
  boostedCount: number;
  reducedCount: number;
  totalPredictions: number;
  withActualResults: number;
  calibrationBuckets: Array<{
    predictedRange: string;
    actualAdmitRate: number;
    count: number;
  }>;
}

interface Suggestion {
  schoolId: string;
  schoolName: string;
  schoolNameZh: string | null;
  usNewsRank: number | null;
  predictionCount: number;
  avgPredicted: number;
  actualAdmitRate: number;
  drift: number;
  suggestedMultiplier: number;
}

// Midpoints for each bucket range
const BUCKET_MIDPOINTS: Record<string, number> = {
  '0-20%': 0.1,
  '20-40%': 0.3,
  '40-60%': 0.5,
  '60-80%': 0.7,
  '80-100%': 0.9,
};

export function OverviewTab() {
  const t = useTranslations('admin.calibrations');
  const locale = useLocale();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<{
    schoolId: string;
    schoolName: string;
    multiplier: number;
  } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<CalibrationStats>({
    queryKey: ['adminCalibrationStats'],
    queryFn: () => apiClient.get(`${API_ROUTES.ADMIN}/calibrations/stats`),
  });

  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery<Suggestion[]>({
    queryKey: ['adminCalibrationSuggestions'],
    queryFn: () => apiClient.get(`${API_ROUTES.ADMIN}/calibrations/suggestions`),
  });

  function handleQuickCalibrate(s: Suggestion) {
    const displayName = locale === 'zh' && s.schoolNameZh ? s.schoolNameZh : s.schoolName;
    setPrefill({
      schoolId: s.schoolId,
      schoolName: displayName,
      multiplier: s.suggestedMultiplier,
    });
    setDialogOpen(true);
  }

  // Compute overall accuracy (average absolute error across buckets)
  const overallAccuracy =
    stats && stats.calibrationBuckets.length > 0
      ? (() => {
          const bucketsWithData = stats.calibrationBuckets.filter((b) => b.count > 0);
          if (bucketsWithData.length === 0) return null;
          const totalError = bucketsWithData.reduce((sum, b) => {
            const midpoint = BUCKET_MIDPOINTS[b.predictedRange] ?? 0.5;
            return sum + Math.abs(b.actualAdmitRate - midpoint);
          }, 0);
          const avgError = totalError / bucketsWithData.length;
          return Math.max(0, Math.round((1 - avgError) * 100));
        })()
      : null;

  // Prepare chart data
  const chartData =
    stats?.calibrationBuckets.map((b) => ({
      range: b.predictedRange,
      predicted: Math.round((BUCKET_MIDPOINTS[b.predictedRange] ?? 0.5) * 100),
      actual: Math.round(b.actualAdmitRate * 100),
      count: b.count,
    })) ?? [];

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <SlidersHorizontal className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCalibrations ?? 0}</p>
                <p className="text-sm text-muted-foreground">{t('stats.calibratedSchools')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.withActualResults ?? 0}</p>
                <p className="text-sm text-muted-foreground">
                  {t('stats.predictionsWithOutcomes')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {overallAccuracy !== null ? `${overallAccuracy}%` : '—'}
                </p>
                <p className="text-sm text-muted-foreground">{t('stats.overallAccuracy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suggestions.length}</p>
                <p className="text-sm text-muted-foreground">
                  {t('stats.schoolsNeedingAttention')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('charts.accuracyTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" className="text-xs" />
                <YAxis tickFormatter={(v: number) => `${v}%`} className="text-xs" />
                <Tooltip
                  formatter={(value, name) => [
                    `${typeof value === 'number' ? value : String(value)}%`,
                    name === 'predicted' ? t('charts.predicted') : t('charts.actual'),
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    value === 'predicted' ? t('charts.predicted') : t('charts.actual')
                  }
                />
                <Bar
                  dataKey="predicted"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                  opacity={0.5}
                />
                <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Schools Needing Calibration */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {t('suggestions.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t('suggestions.description')}</p>
          </div>
        </CardHeader>
        <CardContent>
          {suggestionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>{t('suggestions.allAccurate')}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">{t('school')}</th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t('suggestions.predictionCount')}
                    </th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t('suggestions.avgPredicted')}
                    </th>
                    <th className="px-3 py-2 text-center font-medium">
                      {t('suggestions.actualRate')}
                    </th>
                    <th className="px-3 py-2 text-center font-medium">{t('suggestions.drift')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => {
                    const driftPercent = Math.round(s.drift * 100);
                    const isTooHigh = s.drift < 0;
                    return (
                      <tr key={s.schoolId} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div>
                            <p className="font-medium">
                              {getSchoolName(
                                {
                                  name: s.schoolName,
                                  nameZh: s.schoolNameZh,
                                },
                                locale
                              )}
                            </p>
                            {s.usNewsRank && (
                              <span className="text-xs text-muted-foreground">
                                US News #{s.usNewsRank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">{s.predictionCount}</td>
                        <td className="px-3 py-2 text-center">
                          {Math.round(s.avgPredicted * 100)}%
                        </td>
                        <td className="px-3 py-2 text-center">
                          {Math.round(s.actualAdmitRate * 100)}%
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant="outline"
                            className={
                              isTooHigh
                                ? 'border-red-500/50 text-red-600 dark:text-red-400'
                                : 'border-blue-500/50 text-blue-600 dark:text-blue-400'
                            }
                          >
                            {driftPercent > 0 ? '+' : ''}
                            {driftPercent}%
                            {isTooHigh
                              ? ` (${t('suggestions.tooHigh')})`
                              : ` (${t('suggestions.tooLow')})`}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickCalibrate(s)}
                          >
                            {t('suggestions.quickCalibrate')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Calibrate Dialog */}
      <CalibrationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefillSchoolId={prefill?.schoolId}
        prefillSchoolName={prefill?.schoolName}
        prefillMultiplier={prefill?.multiplier}
      />
    </div>
  );
}
