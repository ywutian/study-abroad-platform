'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SchoolRanking, RANKING_LIST_KEYS, getDisplayRankings } from '@/lib/utils/ranking';

interface RankingBadgeProps {
  /** Multi-source rankings from SchoolRanking table */
  rankings?: SchoolRanking[];
  /** Legacy fallback — used when rankings is empty */
  usNewsRank?: number;
  /** Max badges to show (default: 1) */
  maxBadges?: number;
  /** Visual variant */
  variant?: 'default' | 'amber' | 'plain';
  className?: string;
}

/**
 * Displays school ranking badges with source context.
 * Prioritizes multi-source rankings; falls back to usNewsRank with "US News" label.
 */
export function RankingBadge({
  rankings,
  usNewsRank,
  maxBadges = 1,
  variant = 'default',
  className,
}: RankingBadgeProps) {
  const t = useTranslations('common');
  const displayRankings = getDisplayRankings(rankings);

  const badgeClassName = cn(
    'shrink-0 gap-0.5 text-xs',
    variant === 'amber' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    className
  );

  if (displayRankings.length > 0) {
    return (
      <>
        {displayRankings.slice(0, maxBadges).map((r) => (
          <Tooltip key={`${r.source}-${r.list}`}>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={badgeClassName}>
                {variant === 'amber' && <Trophy className="h-3 w-3" />}
                {r.source} {t(`rankingList.${RANKING_LIST_KEYS[r.list] || 'nationalUniversity'}`)} #
                {r.rank}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('rankingTooltip', { source: r.source, year: r.year })}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </>
    );
  }

  if (usNewsRank) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={badgeClassName}>
            {variant === 'amber' && <Trophy className="h-3 w-3" />}
            US News #{usNewsRank}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('rankingTooltipOverall')}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
