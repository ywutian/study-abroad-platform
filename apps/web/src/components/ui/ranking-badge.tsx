'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
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

  // `amber` is an inline marker badge that sits next to truncating text
  // (e.g. school name + ranking row). The WCAG 2.5.5 tap-target floor
  // applies to interactive controls; this badge is non-interactive, so
  // dropping the min-w/min-h on amber lets the parent `truncate` chain
  // actually shrink. The default variant keeps the floor.
  const badgeClassName = cn(
    'shrink-0 gap-0.5 text-xs',
    variant !== 'amber' && 'min-h-10 min-w-10 sm:min-h-8 sm:min-w-8',
    variant === 'amber' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    className
  );

  if (displayRankings.length > 0) {
    return (
      <>
        {displayRankings.slice(0, maxBadges).map((r) => {
          const sourceLabel = getRankingSourceLabel(r.source);
          const isFallback = r.confidence === 'fallback';
          const listLabel = isFallback
            ? t('rankingFallbackShort')
            : t(`rankingList.${getRankingListLabelKey(r.list)}` as never);
          const tooltipText = isFallback
            ? t('rankingTooltipFallback', { source: sourceLabel, year: r.year })
            : t('rankingTooltip', { source: sourceLabel, year: r.year });

          return (
            <Badge
              key={`${r.source}-${r.list}`}
              variant="outline"
              className={badgeClassName}
              title={tooltipText}
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
          );
        })}
      </>
    );
  }

  return null;
}
