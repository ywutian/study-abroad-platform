'use client';

import { memo, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PredictionDashboardData } from '@/hooks/use-prediction';

interface DashboardSummaryProps {
  data: PredictionDashboardData;
  dataCompleteness?: number;
}

export const DashboardSummary = memo(function DashboardSummary({
  data,
  dataCompleteness,
}: DashboardSummaryProps) {
  const t = useTranslations();
  const locale = useLocale();

  const probRange = useMemo(() => {
    if (data.predictions.length === 0) return { min: 0, max: 0 };
    const probs = data.predictions.map((p) => Math.round(p.probability * 100));
    return { min: Math.min(...probs), max: Math.max(...probs) };
  }, [data.predictions]);

  return (
    <div className="mb-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-overline text-muted-foreground">
            {t('predictionDashboard.totalSchools')}
          </div>
          <div className="text-2xl font-bold text-metric mt-1">{data.totalSchools}</div>
        </Card>
        <Card className="p-4">
          <div className="text-overline text-muted-foreground">
            {t('predictionDashboard.avgProbability')}
          </div>
          <div className="text-2xl font-bold text-metric text-primary mt-1">
            {data.avgProbability}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-overline text-muted-foreground">
            {t('predictionDashboard.tierDistribution')}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
              {t('prediction.tier.reach')} {data.tierDistribution.reach}
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {t('prediction.tier.match')} {data.tierDistribution.match}
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {t('prediction.tier.safety')} {data.tierDistribution.safety}
            </Badge>
          </div>
        </Card>
        <Card className="p-4">
          {dataCompleteness !== undefined ? (
            <>
              <div className="text-overline text-muted-foreground">
                {t('predictionDashboard.dataCompleteness')}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="relative h-10 w-10 shrink-0">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      className="text-muted/20"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${dataCompleteness * 1.005} 100.53`}
                      className={cn(
                        dataCompleteness >= 70
                          ? 'text-emerald-500'
                          : dataCompleteness >= 40
                            ? 'text-amber-500'
                            : 'text-rose-500'
                      )}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {dataCompleteness}
                  </span>
                </div>
                <div className="min-w-0">
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      dataCompleteness >= 70
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : dataCompleteness >= 40
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {t(
                      `predictionDashboard.completeness.${
                        dataCompleteness >= 70 ? 'good' : dataCompleteness >= 40 ? 'fair' : 'low'
                      }`
                    )}
                  </div>
                  {dataCompleteness < 70 && (
                    <Link
                      href={`/${locale}/profile`}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('predictionDashboard.improveProfile')}
                    </Link>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-overline text-muted-foreground">
                {t('predictionDashboard.probabilityRange')}
              </div>
              <div className="text-2xl font-bold text-metric mt-1">
                {probRange.min === probRange.max
                  ? `${probRange.min}%`
                  : `${probRange.min}% – ${probRange.max}%`}
              </div>
            </>
          )}
        </Card>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs text-muted-foreground">
          {t('prediction.probabilityVsRateDisclaimer')}
        </p>
        <p className="text-xs text-muted-foreground">{t('prediction.tierStrategyDisclaimer')}</p>
      </div>
    </div>
  );
});
