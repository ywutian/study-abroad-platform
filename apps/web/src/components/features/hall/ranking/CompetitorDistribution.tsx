'use client';

/**
 * CompetitorDistribution — per-dimension distribution bars (p25-p75 band +
 * user position) plus the competitor stats summary line for one school.
 */

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RankingResult } from '@/types/hall';

interface CompetitorDistributionProps {
  result: RankingResult;
  /** Stagger delay seed (card index) for the animated bars. */
  index: number;
}

export function CompetitorDistribution({ result, index }: CompetitorDistributionProps) {
  const t = useTranslations();

  const dimensions = [
    {
      key: 'academic' as const,
      label: t('hall.ranking.factorAcademic'),
      score: result.breakdown.academic,
      percentile: result.percentiles?.academic,
      median: result.scoreDistribution?.academic?.p50,
      color: 'bg-blue-500',
    },
    {
      key: 'activity' as const,
      label: t('hall.ranking.factorActivities'),
      score: result.breakdown.activity,
      percentile: result.percentiles?.activity,
      median: result.scoreDistribution?.activity?.p50,
      color: 'bg-emerald-500',
    },
    {
      key: 'award' as const,
      label: t('hall.ranking.factorAwards'),
      score: result.breakdown.award,
      percentile: result.percentiles?.award,
      median: result.scoreDistribution?.award?.p50,
      color: 'bg-amber-500',
    },
  ];

  return (
    <>
      <TooltipProvider>
        <div className="space-y-3">
          {dimensions.map((dim) => {
            const diff = dim.median != null ? Math.round((dim.score - dim.median) * 10) / 10 : null;
            const dist = result.scoreDistribution?.[dim.key];

            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs text-muted-foreground min-w-0 truncate">
                    {dim.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {diff != null && (
                      <span
                        className={cn(
                          'text-xs',
                          diff >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500 dark:text-red-400'
                        )}
                      >
                        {diff >= 0 ? '+' : ''}
                        {diff.toFixed(1)} vs {t('hall.ranking.median')}
                      </span>
                    )}
                    <span className="text-xs font-semibold tabular-nums w-12 text-right">
                      {dim.percentile != null ? `${dim.percentile}%` : `${Math.round(dim.score)}`}
                    </span>
                  </div>
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                      {dist && (
                        <div
                          className="absolute h-full bg-muted-foreground/15 rounded-full"
                          style={{
                            left: `${Math.max(0, dist.p25)}%`,
                            width: `${Math.max(1, dist.p75 - dist.p25)}%`,
                          }}
                        />
                      )}
                      <motion.div
                        className={cn('h-full rounded-full', dim.color)}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, dim.percentile ?? Math.round(dim.score))}%`,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 50,
                          damping: 20,
                          delay: index * 0.1 + 0.1,
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  {dist && (
                    <TooltipContent side="top" className="text-xs">
                      <p>
                        {t('hall.ranking.middle50', {
                          low: dist.p25.toFixed(1),
                          high: dist.p75.toFixed(1),
                        })}
                      </p>
                      <p>
                        {t('hall.ranking.median')}: {dist.p50.toFixed(1)}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            );
          })}
        </div>
      </TooltipProvider>

      {result.competitorStats && (
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          <span>
            {t('hall.ranking.average')}: {result.competitorStats.avgScore.toFixed(1)}
          </span>
          <span className="text-border">|</span>
          <span>
            {t('hall.ranking.median')}: {result.competitorStats.medianScore.toFixed(1)}
          </span>
          <span className="text-border">|</span>
          <span>
            <Users className="h-3 w-3 inline mr-0.5" />
            {result.competitorStats.totalCount}
          </span>
        </div>
      )}
    </>
  );
}
