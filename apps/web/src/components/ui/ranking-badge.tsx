'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type SchoolRanking,
  type RankingListSelection,
  createLegacyUsNewsRanking,
  getDisplayRankings,
  getRankingListLabelKey,
  getRankingSourceLabel,
} from '@/lib/utils/ranking';

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
  preferredRankingList?: RankingListSelection;
}

/**
 * Displays school ranking badges with source/list/confidence context.
 * Prioritizes verified SchoolRanking rows; marks legacy usNewsRank fallback explicitly.
 */
export function RankingBadge({
  rankings,
  usNewsRank,
  maxBadges = 1,
  variant = 'default',
  className,
  preferredRankingList,
}: RankingBadgeProps) {
  const t = useTranslations('common');
  const fallbackRanking = createLegacyUsNewsRanking(usNewsRank);
  const displayRankings = getDisplayRankings(
    rankings?.length ? rankings : fallbackRanking ? [fallbackRanking] : [],
    preferredRankingList
  );

  const badgeClassName = cn(
    'shrink-0 gap-0.5 text-xs',
    variant === 'amber' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    className
  );

  if (displayRankings.length > 0) {
    return (
      <TooltipProvider>
        {displayRankings.slice(0, maxBadges).map((r) => {
          const sourceLabel = getRankingSourceLabel(r.source);
          const isFallback = r.confidence === 'fallback';
          const listLabel = isFallback
            ? t('rankingFallbackShort')
            : t(`rankingList.${getRankingListLabelKey(r.list)}` as any);

          return (
            <Tooltip key={`${r.source}-${r.list}`}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={badgeClassName}
                  aria-label={
                    isFallback
                      ? t('rankingAriaFallback', { source: sourceLabel, rank: r.rank })
                      : t('rankingAria', {
                          source: sourceLabel,
                          list: listLabel,
                          rank: r.rank,
                        })
                  }
                >
                  {variant === 'amber' && <Trophy className="h-3 w-3" />}
                  {sourceLabel} {listLabel} #{r.rank}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isFallback
                    ? t('rankingTooltipFallback', { source: sourceLabel, year: r.year })
                    : t('rankingTooltip', { source: sourceLabel, year: r.year })}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    );
  }

  return null;
}
