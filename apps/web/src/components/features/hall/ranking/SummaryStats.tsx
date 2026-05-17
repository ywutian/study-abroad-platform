'use client';

/**
 * SummaryStats — top-of-tab aggregate row: average percentile, total
 * competitors, best school, and overall competitive position.
 */

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProbabilityRing, AnimatedStat } from '@/components/features/probability-ring';
import { POSITION_CONFIG, type CompetitivePosition } from './ranking-shared';

export interface RankingSummary {
  avgPercentile: number;
  totalCompetitors: number;
  bestSchool: string;
  overallPosition: CompetitivePosition;
}

interface SummaryStatsProps {
  summary: RankingSummary;
}

export function SummaryStats({ summary }: SummaryStatsProps) {
  const t = useTranslations();
  const config = POSITION_CONFIG[summary.overallPosition];
  const PositionIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
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
      <div className="rounded-xl border bg-card p-3 sm:p-4 flex flex-col items-center justify-center gap-1 min-w-0">
        <PositionIcon className="h-5 w-5" />
        <Badge variant="outline" className={cn('text-xs', config.className)}>
          {t(`hall.ranking.${summary.overallPosition}`)}
        </Badge>
        <p className="text-xs text-muted-foreground">{t('hall.ranking.overallPosition')}</p>
      </div>
    </motion.div>
  );
}
