'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { TIER_CONFIG } from './constants';
import type { PredictionResult } from './types';

interface PredictionResultRowProps {
  result: PredictionResult;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * A compact, FIXED-shape row in the workbench list (scan) column. It carries no
 * expand state, no async sub-panels and no height animation — the full analysis
 * lives in the detail pane. Because every row is structurally the same height,
 * the list can hold 100 schools (and be windowed later) without the variable-
 * height-in-a-virtual-list bug class that the old fat card created.
 */
export const PredictionResultRow = memo(
  function PredictionResultRow({ result, isSelected, onSelect }: PredictionResultRowProps) {
    const t = useTranslations('prediction');

    const isUnavailable =
      result.probability == null ||
      result.tier === 'unavailable' ||
      result.predictionMethod === 'insufficient_data';
    const tierConfig = TIER_CONFIG[result.tier] ?? TIER_CONFIG.unavailable;
    const probabilityRange =
      result.probabilityLow !== undefined && result.probabilityHigh !== undefined
        ? `${(result.probabilityLow * 100).toFixed(0)}-${(result.probabilityHigh * 100).toFixed(0)}%`
        : null;
    const headline =
      result.publicExplanation?.headline ??
      result.factors.find((f) => f.impact === 'positive')?.name ??
      result.factors[0]?.name;

    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={t('viewAnalysisFor', { school: result.schoolName })}
        className={cn(
          'group flex w-full items-center gap-3 rounded-[var(--theme-radius-button)] border p-3 text-left transition-colors',
          'min-h-[68px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          isSelected
            ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/40'
            : 'border-border bg-card hover:border-primary/25 hover:bg-muted/40'
        )}
      >
        {/* Tier accent */}
        <span className={cn('h-9 w-1 shrink-0 rounded-full', tierConfig.barColor)} aria-hidden />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {result.schoolName}
            </span>
            <span className={cn('shrink-0 text-sm font-semibold tabular-nums', tierConfig.text)}>
              {isUnavailable ? t('tier.unavailable') : (probabilityRange ?? '—')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('h-5 shrink-0 px-1.5 text-2xs', tierConfig.badge)}
            >
              {isUnavailable ? t('tier.unavailable') : t(`tier.${result.tier}`)}
            </Badge>
            <RankingBadge
              rankings={result.schoolMeta?.rankings}
              usNewsRank={result.schoolMeta?.usNewsRank}
              variant="plain"
            />
            {headline && (
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {headline}
              </span>
            )}
          </div>
        </div>

        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )}
          aria-hidden
        />
      </button>
    );
  },
  (prev, next) => prev.result === next.result && prev.isSelected === next.isSelected
);
