/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import type { MajorBreakdown } from '@study-abroad/shared/types';
import { formatPercentValue, resolveContextualBaseline } from './benchmark-utils';

interface RateBreakdownPanelProps {
  schoolMeta?: {
    usNewsRank?: number;
    acceptanceRate?: number;
    intlAcceptanceRate?: number;
    oosAcceptanceRate?: number;
    intlStudentPct?: number;
    needBlindInternational?: boolean;
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
  };
  majorBreakdown?: MajorBreakdown;
  communityInsight?: {
    majorAdmitRate: number;
    totalCases: number;
    major: string;
  };
  probability: number;
  isInternational: boolean;
  roundContext?: string | null;
}

function RateBar({
  label,
  rate,
  tooltip,
  na,
}: {
  label: string;
  rate?: number | null;
  tooltip?: string;
  na?: string;
}) {
  const hasData = rate != null && rate >= 0;
  const pct = hasData ? Math.round(rate * 10) / 10 : 0;
  const barWidth = hasData ? Math.max(2, Math.min(100, pct)) : 0;

  const barColor = hasData
    ? pct > 50
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : pct > 20
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-500 dark:bg-rose-400'
    : 'bg-muted';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1.5">
          {label}
          {tooltip && (
            <span className="group relative">
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
              <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground border rounded-md shadow-md whitespace-nowrap z-50">
                {tooltip}
              </span>
            </span>
          )}
        </span>
        <span className={cn('font-medium tabular-nums', hasData ? '' : 'text-muted-foreground')}>
          {hasData ? `${pct}%` : na || 'N/A'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        {hasData && (
          <div
            className={cn('h-full rounded-full transition-all duration-700 ease-out', barColor)}
            style={{ width: `${barWidth}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function RateBreakdownPanel({
  schoolMeta,
  majorBreakdown,
  communityInsight,
  probability,
  isInternational,
  roundContext,
}: RateBreakdownPanelProps) {
  const t = useTranslations('prediction');
  const contextualBaseline = resolveContextualBaseline({
    schoolMeta,
    isInternational,
    roundContext,
    probability,
  });

  const hasAnyData =
    schoolMeta?.acceptanceRate != null ||
    schoolMeta?.intlAcceptanceRate != null ||
    majorBreakdown != null ||
    contextualBaseline != null;

  if (!hasAnyData && !isInternational) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card/50 p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">{t('rateBreakdown.title')}</h4>

      <div className="space-y-3">
        <RateBar label={t('rateBreakdown.overall')} rate={schoolMeta?.acceptanceRate} />

        {isInternational && (
          <RateBar
            label={t('rateBreakdown.international')}
            rate={schoolMeta?.intlAcceptanceRate}
            tooltip={schoolMeta?.intlAcceptanceRate == null ? t('rateBreakdown.naIntl') : undefined}
            na={t('rateBreakdown.na')}
          />
        )}

        {!isInternational && schoolMeta?.oosAcceptanceRate != null && (
          <RateBar
            label={t('rateBreakdown.outOfState')}
            rate={schoolMeta.oosAcceptanceRate}
            tooltip={t('rateBreakdown.oosTooltip')}
          />
        )}

        {contextualBaseline && (
          <RateBar
            label={
              contextualBaseline.roundAdjusted
                ? t('rateBreakdown.contextualBaselineWithRound', {
                    round: contextualBaseline.roundContext,
                  })
                : t('rateBreakdown.contextualBaseline')
            }
            rate={contextualBaseline.rate}
            tooltip={t('rateBreakdown.contextualBaselineTooltip')}
          />
        )}

        {majorBreakdown && (
          <RateBar
            label={t('rateBreakdown.majorEstimate', { major: majorBreakdown.majorName })}
            rate={majorBreakdown.acceptanceRateEstimate}
            tooltip={
              majorBreakdown.acceptanceRateEstimate == null ? t('rateBreakdown.naMajor') : undefined
            }
            na={t('rateBreakdown.na')}
          />
        )}

        {communityInsight && communityInsight.totalCases >= 5 && (
          <RateBar
            label={t('rateBreakdown.communityData', {
              count: communityInsight.totalCases,
            })}
            rate={communityInsight.majorAdmitRate * 100}
            tooltip={t('rateBreakdown.communityTooltip', {
              count: communityInsight.totalCases,
            })}
          />
        )}

        <RateBar label={t('rateBreakdown.yourProbability')} rate={probability * 100} />
      </div>

      {/* Context badges */}
      <div className="flex flex-wrap gap-2 pt-1">
        {contextualBaseline && (
          <>
            <Badge variant="secondary" className="text-xs">
              {contextualBaseline.baseType === 'international'
                ? t('rateBreakdown.international')
                : t('rateBreakdown.overall')}
            </Badge>
            {contextualBaseline.roundAdjusted && (
              <Badge variant="secondary" className="text-xs">
                {t('rateBreakdown.roundAdjusted', {
                  round: contextualBaseline.roundContext,
                })}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                'text-xs',
                contextualBaseline.deltaPoints > 2
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : contextualBaseline.deltaPoints < -2
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    : ''
              )}
            >
              {contextualBaseline.deltaPoints > 2
                ? t('rateBreakdown.deltaAbove', {
                    points: formatPercentValue(contextualBaseline.deltaPoints),
                  })
                : contextualBaseline.deltaPoints < -2
                  ? t('rateBreakdown.deltaBelow', {
                      points: formatPercentValue(Math.abs(contextualBaseline.deltaPoints)),
                    })
                  : t('rateBreakdown.deltaNear')}
            </Badge>
          </>
        )}
        {schoolMeta?.needBlindInternational && (
          <Badge
            variant="secondary"
            className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
          >
            {t('rateBreakdown.needBlind')}
          </Badge>
        )}
        {schoolMeta?.intlStudentPct != null && (
          <Badge variant="secondary" className="text-xs">
            {t('rateBreakdown.intlPercent', {
              pct: Math.round(schoolMeta.intlStudentPct),
            })}
          </Badge>
        )}
        {majorBreakdown && (
          <Badge
            variant="secondary"
            className={cn(
              'text-xs',
              majorBreakdown.competitiveness >= 4
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                : majorBreakdown.competitiveness <= 2
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : ''
            )}
          >
            {majorBreakdown.majorName}:{' '}
            {t(`rateBreakdown.competitiveness.${majorBreakdown.competitiveness}` as any)}
          </Badge>
        )}
      </div>
    </div>
  );
}
