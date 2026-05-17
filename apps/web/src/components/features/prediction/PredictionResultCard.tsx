/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { memo, useRef, useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RankingBadge } from '@/components/ui/ranking-badge';
import {
  ChevronDown,
  ChevronUp,
  Award,
  RefreshCw,
  CheckCircle2,
  Info,
  Database,
  AlertTriangle,
  MessageSquareText,
  BadgeCheck,
  ChevronRight,
} from 'lucide-react';
import { cn, formatAcceptanceRate } from '@/lib/utils';
import { AgentType } from '@study-abroad/shared';
import { Link } from '@/lib/i18n/navigation';
import { openFloatingAgentChat } from '@/components/features/agent-chat/floating-chat-bridge';
import { TIER_CONFIG, getProbabilityColor } from './constants';
import type { PredictionResult } from './types';
import { formatPercentValue, resolveContextualBaseline } from './benchmark-utils';
import { PredictionExplanationStream } from './PredictionExplanationStream';

// Lazy load expanded panels
const FactorsPanel = dynamic(
  () => import('./FactorsPanel').then((m) => ({ default: m.FactorsPanel })),
  { ssr: false }
);
const ComparisonPanel = dynamic(
  () => import('./ComparisonPanel').then((m) => ({ default: m.ComparisonPanel })),
  { ssr: false }
);
const SuggestionsPanel = dynamic(
  () => import('./SuggestionsPanel').then((m) => ({ default: m.SuggestionsPanel })),
  { ssr: false }
);
const ResultFeedbackButtons = dynamic(
  () => import('./ResultFeedbackButtons').then((m) => ({ default: m.ResultFeedbackButtons })),
  { ssr: false }
);
const PredictionFeedbackWidget = dynamic(
  () =>
    import('./PredictionFeedbackWidget').then((m) => ({
      default: m.PredictionFeedbackWidget,
    })),
  { ssr: false }
);
const PredictionHistoryPanel = dynamic(
  () => import('./PredictionHistoryPanel').then((m) => ({ default: m.PredictionHistoryPanel })),
  { ssr: false }
);
const RateBreakdownPanel = dynamic(
  () => import('./RateBreakdownPanel').then((m) => ({ default: m.RateBreakdownPanel })),
  { ssr: false }
);

interface PredictionResultCardProps {
  result: PredictionResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onResultReported?: (schoolId: string, result: string) => void;
  onRefresh?: (schoolId: string) => void;
  isRefreshing?: boolean;
  isInternational?: boolean;
  dataCompleteness?: number;
}

/** Compute relative time string (e.g. "5 min ago") */
function getTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function humanizeMachineLabel(value: string): string {
  if (!value) return value;
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (!/[a-z]/i.test(normalized)) return value;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSourceSummary(sourceSummary?: PredictionResult['sourceSummary']): {
  primary?: string;
  secondary?: string[];
} {
  if (!sourceSummary?.length) return {};

  const [first, ...rest] = sourceSummary;
  const secondary = Array.from(
    new Set(
      rest
        .map((item) => (item.detail ? `${item.label}: ${item.detail}` : item.label))
        .filter(Boolean)
    )
  );

  return {
    primary: first.detail ? `${first.label}: ${first.detail}` : first.label,
    secondary: secondary.length > 0 ? secondary : undefined,
  };
}

/** Determine accuracy badge based on actual result vs prediction tier */
function getAccuracyBadge(
  actualResult: string,
  tier: string
): {
  label: 'predictionAccurate' | 'outperformedPrediction';
  variant: 'accurate' | 'outperformed';
} | null {
  const admitted = actualResult === 'ADMITTED';
  const rejected = actualResult === 'REJECTED';

  if (admitted && tier === 'safety') return { label: 'predictionAccurate', variant: 'accurate' };
  if (admitted && tier === 'match') return { label: 'predictionAccurate', variant: 'accurate' };
  if (admitted && tier === 'reach')
    return { label: 'outperformedPrediction', variant: 'outperformed' };
  if (rejected && tier === 'reach') return { label: 'predictionAccurate', variant: 'accurate' };
  if (rejected && tier === 'safety')
    return { label: 'outperformedPrediction', variant: 'outperformed' };

  return null;
}

export const PredictionResultCard = memo(
  function PredictionResultCard({
    result,
    isExpanded,
    onToggleExpand,
    onResultReported,
    onRefresh,
    isRefreshing,
    isInternational,
    dataCompleteness,
  }: PredictionResultCardProps) {
    const t = useTranslations('prediction');
    const expandedRef = useRef<HTMLDivElement>(null);

    const isUnavailable =
      result.probability == null ||
      result.tier === 'unavailable' ||
      result.predictionMethod === 'insufficient_data';
    const numericProbability = result.probability ?? 0;
    const tierConfig = TIER_CONFIG[result.tier] ?? TIER_CONFIG.unavailable;
    const TierIcon = tierConfig.icon;
    const publicExplanation = result.publicExplanation;
    const dataSupportLabel =
      publicExplanation?.dataSupportLabel ?? t(`confidence.${result.confidence ?? 'medium'}`);

    const probPercent = isUnavailable ? null : (numericProbability * 100).toFixed(0);
    const normalizedSourceSummary = normalizeSourceSummary(result.sourceSummary);
    const uncertaintyReasons = (result.uncertaintyReasons ?? []).filter(Boolean);
    const hasPredictionContext = Boolean(
      result.roundContext ||
      result.cohortKey ||
      normalizedSourceSummary.primary ||
      normalizedSourceSummary.secondary?.length ||
      result.confidenceReason ||
      uncertaintyReasons.length
    );
    const dataQuality = result.schoolMeta?.dataQuality;
    const hasDataQualityWarning = Boolean(
      dataQuality && dataQuality.summary !== 'strong' && dataQuality.impactedFields.length > 0
    );
    const probabilityRange =
      result.probabilityLow !== undefined && result.probabilityHigh !== undefined
        ? `${(result.probabilityLow * 100).toFixed(0)}-${(result.probabilityHigh * 100).toFixed(0)}%`
        : null;
    const predictionContext = {
      type: 'prediction-results' as const,
      source: 'prediction_result_card' as const,
      results: [
        {
          schoolId: result.schoolId,
          schoolName: result.schoolName,
          probability: numericProbability,
          tier: result.tier,
          confidence: result.confidence,
          source: result.source,
          modelVersion: result.modelVersion,
          cohortKey: result.cohortKey,
          roundContext: result.roundContext,
          sourceSummary: result.sourceSummary,
          uncertaintyReasons: result.uncertaintyReasons,
          confidenceReason: result.confidenceReason,
          latestOutcomeLabel: result.latestOutcomeLabel,
          schoolMeta: result.schoolMeta,
        },
      ],
      summary: {
        total: 1,
        reach: result.tier === 'reach' ? 1 : 0,
        match: result.tier === 'match' ? 1 : 0,
        safety: result.tier === 'safety' ? 1 : 0,
        avgProbability: numericProbability,
      },
    };
    const contextualBaseline = isUnavailable
      ? null
      : resolveContextualBaseline({
          schoolMeta: result.schoolMeta,
          isInternational: isInternational ?? false,
          roundContext: result.roundContext,
          probability: numericProbability,
        });
    const isCounselorEstimate = result.predictionMethod === 'counselor';
    const hasExpandedContent =
      result.factors.length > 0 ||
      result.suggestions.length > 0 ||
      result.comparison ||
      result.engineScores ||
      publicExplanation ||
      hasPredictionContext ||
      hasDataQualityWarning;

    // Accuracy badge
    const accuracyBadge = result.actualResult
      ? getAccuracyBadge(result.actualResult, result.tier)
      : null;
    const topFactors = result.factors.slice(0, 3);
    const nextSuggestion = result.suggestions[0];

    // Focus management: focus expanded region when opened
    useEffect(() => {
      if (isExpanded && expandedRef.current) {
        expandedRef.current.focus();
      }
    }, [isExpanded]);

    return (
      <Card className="overflow-hidden">
        {/* Tier color bar */}
        <div className={cn('h-1.5', tierConfig.bar)} />

        <CardContent className="py-4">
          {/* Row 1: School info + probability */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{result.schoolName}</span>
                <Badge className={tierConfig.badge}>
                  <TierIcon className="h-3 w-3 mr-1" />
                  {isUnavailable ? 'Unavailable' : t(`tier.${result.tier}`)}
                </Badge>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary">
                  <Database className="h-3 w-3" />
                  {dataSupportLabel}
                </Badge>
                {/* Accuracy badge when actual result reported */}
                {accuracyBadge && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      accuracyBadge.variant === 'accurate'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {accuracyBadge.variant === 'outperformed' ? (
                      <Award className="h-3 w-3 mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    {t(accuracyBadge.label)}
                  </Badge>
                )}
              </div>
              {/* School metadata + meta line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <RankingBadge
                  rankings={result.schoolMeta?.rankings}
                  usNewsRank={result.schoolMeta?.usNewsRank}
                  variant="plain"
                />
                {result.schoolMeta?.acceptanceRate != null && (
                  <Badge variant="secondary" className="text-xs py-0">
                    {t('schoolAcceptanceRateLabel', {
                      rate: formatAcceptanceRate(result.schoolMeta.acceptanceRate).replace('%', ''),
                    })}
                  </Badge>
                )}
                {result.roundContext && (
                  <Badge variant="outline" className="text-xs py-0">
                    {t('roundContextChip', {
                      value: humanizeMachineLabel(result.roundContext),
                    })}
                  </Badge>
                )}
                {probabilityRange && (
                  <span>
                    {t('range')}: {probabilityRange}
                  </span>
                )}
                {hasDataQualityWarning && dataQuality && (
                  <Badge variant="outline" className="text-xs py-0 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t(`dataQuality.summary.${dataQuality.summary}`)}
                  </Badge>
                )}
                {/* Cache: show relative time or "Cached" fallback */}
                {result.fromCache && (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs py-0">
                      {result.cachedAt
                        ? t('updatedAgo', { time: getTimeAgo(result.cachedAt) })
                        : t('fromCache')}
                    </Badge>
                    {onRefresh && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRefresh(result.schoolId);
                        }}
                        disabled={isRefreshing}
                        className="inline-flex items-center text-xs text-primary hover:text-primary/80 disabled:opacity-50"
                        title={t('refreshPrediction')}
                      >
                        <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Probability ring */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative">
                <svg
                  className="h-16 w-16 -rotate-90"
                  viewBox="0 0 64 64"
                  role="img"
                  aria-label={
                    isUnavailable
                      ? 'Not enough data'
                      : `${t('estimatedProbabilityLabel')} ${probPercent}%`
                  }
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    stroke="currentColor"
                    strokeWidth="5"
                    fill="none"
                    className="text-muted/20"
                  />
                  {!isUnavailable && (
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="currentColor"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                      className={tierConfig.text}
                      initial={{ strokeDasharray: '0 163.36' }}
                      animate={{ strokeDasharray: `${numericProbability * 163.36} 163.36` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  )}
                </svg>
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center text-lg font-bold text-metric rotate-0',
                    isUnavailable ? tierConfig.text : getProbabilityColor(numericProbability)
                  )}
                >
                  {isUnavailable ? <AlertTriangle className="h-5 w-5" /> : `${probPercent}%`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {isUnavailable ? 'Not enough data' : t('estimatedProbabilityLabel')}
              </span>
              {contextualBaseline && (
                <span className="text-2xs text-muted-foreground mt-0.5">
                  {t('rateBreakdown.contextualBaselineShort', {
                    rate: formatPercentValue(contextualBaseline.rate),
                  })}
                </span>
              )}
              {hasExpandedContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleExpand}
                  className="mt-2 h-8 px-3 text-xs"
                >
                  {isExpanded ? t('collapse') : t('viewBasis')}
                </Button>
              )}
            </div>
          </div>

          {(publicExplanation || topFactors.length > 0 || nextSuggestion) && (
            <div className="mt-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                {t('decisionSignals')}
              </p>
              {publicExplanation?.headline && (
                <p className="mt-1 text-sm font-medium text-foreground">
                  {publicExplanation.headline}
                </p>
              )}
              {publicExplanation?.reasons?.length ? (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {publicExplanation.reasons.slice(0, 3).map((reason, index) => (
                    <li key={`${result.schoolId}-public-reason-${index}`} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topFactors.map((factor) => (
                    <Badge
                      key={`${result.schoolId}-signal-${factor.name}`}
                      variant={
                        factor.impact === 'positive'
                          ? 'success'
                          : factor.impact === 'negative'
                            ? 'warning'
                            : 'outline'
                      }
                      className="max-w-full text-xs"
                    >
                      <span className="truncate">{factor.name}</span>
                    </Badge>
                  ))}
                </div>
              )}
              {(publicExplanation?.nextAction || nextSuggestion) && (
                <div className="mt-3 rounded-[var(--theme-radius-button)] border bg-background/70 px-3 py-2">
                  <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                    {t('nextAction')}
                  </p>
                  <p className="mt-1 text-sm">{publicExplanation?.nextAction ?? nextSuggestion}</p>
                </div>
              )}

              {/* Stage 7 B2 — cross-link to verified admit data in the Hall */}
              <Link
                href="/hall?tab=verified"
                className="mt-3 flex items-center gap-2 rounded-[var(--theme-radius-button)] border bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t('hallLink.title')}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t('hallLink.body')}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          )}

          {/* Row 3: Expand/collapse trigger */}
          {hasExpandedContent && (
            <div className="mt-3 border-t pt-3">
              <button
                className="w-full flex items-center justify-between py-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                aria-controls={`prediction-detail-${result.schoolId}`}
              >
                <span>{isExpanded ? t('collapse') : t('expand')}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          {/* Row 4: Expanded content */}
          <AnimatePresence>
            {isExpanded && hasExpandedContent && (
              <motion.div
                id={`prediction-detail-${result.schoolId}`}
                role="region"
                ref={expandedRef}
                tabIndex={-1}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden outline-none"
              >
                <div className="space-y-4 pt-3">
                  {(hasPredictionContext || isCounselorEstimate || result.schoolMeta) && (
                    <PredictionDetailSection title={t('detailSections.assessment')}>
                      {hasDataQualityWarning && dataQuality && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                          <p className="text-overline text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <Database className="h-3.5 w-3.5" />
                            {t('dataQuality.title')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('dataQuality.description')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              {t('dataQuality.official', {
                                count: dataQuality.officialFields.length,
                              })}
                            </Badge>
                            {dataQuality.heuristicFields.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {t('dataQuality.heuristic', {
                                  count: dataQuality.heuristicFields.length,
                                })}
                              </Badge>
                            )}
                            {dataQuality.terminalFields.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {t('dataQuality.terminal', {
                                  count: dataQuality.terminalFields.length,
                                })}
                              </Badge>
                            )}
                            {dataQuality.staleFields.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {t('dataQuality.stale', {
                                  count: dataQuality.staleFields.length,
                                })}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                              {t('dataQuality.impactedFields')}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {dataQuality.impactedFields.slice(0, 8).map((field) => (
                                <Badge key={field} variant="outline" className="text-xs">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {hasPredictionContext && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                          <p className="text-overline text-muted-foreground flex items-center gap-1.5">
                            <Info className="h-3.5 w-3.5" />
                            {t('predictionContextTitle')}
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {result.roundContext && (
                              <div className="space-y-1">
                                <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                                  {t('roundContextLabel')}
                                </p>
                                <p className="text-sm font-medium">
                                  {humanizeMachineLabel(result.roundContext)}
                                </p>
                              </div>
                            )}
                            {result.cohortKey && (
                              <div className="space-y-1">
                                <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                                  {t('cohortKeyLabel')}
                                </p>
                                <p className="text-sm font-medium">
                                  {humanizeMachineLabel(result.cohortKey)}
                                </p>
                              </div>
                            )}
                            {normalizedSourceSummary.primary && (
                              <div className="space-y-1">
                                <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                                  {t('sourceSummaryLabel')}
                                </p>
                                <p className="text-sm font-medium">
                                  {normalizedSourceSummary.primary}
                                </p>
                              </div>
                            )}
                            {result.confidenceReason && (
                              <div className="space-y-1">
                                <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                                  {t('confidenceReasonLabel')}
                                </p>
                                <p className="text-sm font-medium">{result.confidenceReason}</p>
                              </div>
                            )}
                          </div>
                          {normalizedSourceSummary.secondary &&
                            normalizedSourceSummary.secondary.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                                  {t('sourceSummarySecondaryLabel')}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {normalizedSourceSummary.secondary.map((item) => (
                                    <Badge key={item} variant="outline" className="text-xs">
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          {uncertaintyReasons.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                                {t('uncertaintyReasonsLabel')}
                              </p>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                {uncertaintyReasons.map((reason, index) => (
                                  <li
                                    key={`${result.schoolId}-uncertainty-${index}`}
                                    className="flex gap-2"
                                  >
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {isCounselorEstimate && (
                        <details className="rounded-lg border bg-primary/5 border-primary/15 p-3">
                          <summary className="cursor-pointer text-sm font-medium text-primary">
                            {t('technicalDetails')}
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div className="space-y-1">
                              <p className="text-overline text-primary flex items-center gap-1.5">
                                <Info className="h-3.5 w-3.5" />
                                {t('counselor.howWeComputed')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {t('counselor.disclaimerBody')}
                              </p>
                            </div>
                            {result.factors.length > 0 && (
                              <div className="space-y-2">
                                {result.factors.map((factor) => (
                                  <div
                                    key={`${result.schoolId}-counselor-${factor.name}`}
                                    className="flex items-start justify-between gap-3 text-sm"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium">{factor.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {factor.detail}
                                      </p>
                                    </div>
                                    {typeof factor.weight === 'number' &&
                                      factor.weight > 0 &&
                                      factor.impact !== 'neutral' && (
                                        <Badge variant="outline" className="shrink-0 text-xs">
                                          {factor.impact === 'negative'
                                            ? '-'
                                            : factor.impact === 'positive'
                                              ? '+'
                                              : ''}
                                          {(factor.weight * 100).toFixed(0)}%
                                        </Badge>
                                      )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      )}

                      {/* School stats overview */}
                      {result.schoolMeta && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {result.schoolMeta.acceptanceRate != null && (
                              <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">
                                  {t('schoolAcceptanceRateLabel', { rate: '' }).replace(': ', '')}
                                </p>
                                <p className="font-semibold text-sm">
                                  {formatAcceptanceRate(result.schoolMeta.acceptanceRate)}
                                </p>
                              </div>
                            )}
                            {result.schoolMeta.usNewsRank != null && (
                              <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">Ranking</p>
                                <div className="mt-1 flex justify-center">
                                  <RankingBadge
                                    rankings={result.schoolMeta.rankings}
                                    usNewsRank={result.schoolMeta.usNewsRank}
                                  />
                                </div>
                              </div>
                            )}
                            {result.schoolMeta.satAvg != null && (
                              <div className="text-center p-2 rounded-lg bg-muted/30">
                                <p className="text-xs text-muted-foreground">SAT Avg</p>
                                <p className="font-semibold text-sm">{result.schoolMeta.satAvg}</p>
                              </div>
                            )}
                            <div className="text-center p-2 rounded-lg bg-primary/5 border border-primary/10">
                              <p className="text-xs text-muted-foreground">
                                {t('estimatedProbabilityLabel')}
                              </p>
                              <p
                                className={cn(
                                  'font-semibold text-sm',
                                  isUnavailable
                                    ? 'text-muted-foreground'
                                    : getProbabilityColor(numericProbability)
                                )}
                              >
                                {isUnavailable ? 'Unavailable' : `${probPercent}%`}
                              </p>
                            </div>
                          </div>
                          {!isUnavailable && (
                            <RateBreakdownPanel
                              schoolMeta={result.schoolMeta}
                              majorBreakdown={(result as any).majorBreakdown}
                              communityInsight={(result as any).communityInsight}
                              probability={numericProbability}
                              isInternational={isInternational ?? false}
                              roundContext={result.roundContext}
                            />
                          )}
                        </div>
                      )}
                    </PredictionDetailSection>
                  )}

                  {/* User-facing reasons */}
                  {(publicExplanation || result.factors.length > 0 || result.comparison) && (
                    <PredictionDetailSection title={t('detailSections.why')}>
                      {publicExplanation && (
                        <div className="space-y-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
                          <p className="text-sm font-medium">{publicExplanation.headline}</p>
                          <ul className="space-y-1.5 text-sm text-muted-foreground">
                            {publicExplanation.reasons.map((reason, index) => (
                              <li
                                key={`${result.schoolId}-expanded-reason-${index}`}
                                className="flex gap-2"
                              >
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                          {publicExplanation.caveats.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {publicExplanation.caveats[0]}
                            </p>
                          )}
                        </div>
                      )}

                      <PredictionExplanationStream result={result} />

                      {result.factors.length > 0 && !isCounselorEstimate && (
                        <details className="rounded-[var(--theme-radius-button)] border bg-background p-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            {t('technicalDetails')}
                          </summary>
                          <div className="pt-3">
                            <FactorsPanel factors={result.factors} />
                          </div>
                        </details>
                      )}

                      {/* Applicant comparison */}
                      {result.comparison && <ComparisonPanel comparison={result.comparison} />}
                    </PredictionDetailSection>
                  )}

                  {/* Suggestions */}
                  {result.suggestions.length > 0 && (
                    <PredictionDetailSection title={t('detailSections.improve')}>
                      <SuggestionsPanel
                        suggestions={result.suggestions}
                        dataCompleteness={dataCompleteness}
                      />
                    </PredictionDetailSection>
                  )}

                  <PredictionDetailSection title={t('detailSections.understanding')}>
                    {/* Prediction history trend */}
                    <PredictionHistoryPanel schoolId={result.schoolId} />

                    {/* Report actual result only for persisted numeric predictions. */}
                    {!isUnavailable && (
                      <ResultFeedbackButtons
                        schoolId={result.schoolId}
                        actualResult={result.latestOutcomeLabel?.result ?? result.actualResult}
                        onResultReported={onResultReported}
                      />
                    )}

                    <PredictionFeedbackWidget predictionResultId={result.id} />

                    {/* Optional counselor follow-up */}
                    <button
                      onClick={() => {
                        openFloatingAgentChat({
                          message: t('detailedAnalysisPrompt', {
                            schoolName: result.schoolName,
                          }),
                          context: predictionContext,
                          agentHint: AgentType.SCHOOL,
                        });
                      }}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                      {t('detailedAnalysis')}
                    </button>
                  </PredictionDetailSection>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    );
  },
  (prev, next) =>
    prev.result === next.result &&
    prev.isExpanded === next.isExpanded &&
    prev.isRefreshing === next.isRefreshing
);

function PredictionDetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-background p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
