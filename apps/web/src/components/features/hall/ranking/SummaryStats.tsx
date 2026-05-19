'use client';

/**
 * SummaryStats — top-of-tab aggregate row: average percentile, total
 * competitors, and best school.
 *
 * 2026-05 Hall Plan C (C1): the 4th tile ("overall competitive position",
 * strong/moderate/challenging) was removed — `competitivePosition` no longer
 * exists. The row is now 3 tiles.
 */

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { ProbabilityRing, AnimatedStat } from '@/components/features/probability-ring';

export interface RankingSummary {
  avgPercentile: number;
  totalCompetitors: number;
  bestSchool: string;
}

interface SummaryStatsProps {
  summary: RankingSummary;
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const t = useTranslations();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
    >
      <div className="rounded-xl border bg-card p-3 sm:p-4 text-center min-w-0">
        <ProbabilityRing
          value={summary.avgPercentile}
          size="sm"
          label={t('hall.ranking.avgPercentile')}
        />
      </div>
      <div className="rounded-xl border bg-card p-3 sm:p-4 min-w-0">
        <AnimatedStat value={summary.totalCompetitors} label={t('hall.ranking.totalCompetitors')} />
      </div>
      <div className="rounded-xl border bg-card p-3 sm:p-4 flex flex-col items-center justify-center gap-1 min-w-0">
        <Trophy className="h-5 w-5 text-amber-500" />
        <p className="text-xs sm:text-sm font-semibold text-center truncate max-w-full">
          {summary.bestSchool}
        </p>
        <p className="text-xs text-muted-foreground">{t('hall.ranking.bestSchool')}</p>
      </div>
    </motion.div>
  );
}
