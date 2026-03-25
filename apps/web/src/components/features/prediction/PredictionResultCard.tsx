/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { memo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Bot,
  Trophy,
  Award,
  RefreshCw,
  CheckCircle2,
  BarChart3,
  Brain,
  BookOpen,
} from 'lucide-react';
import { cn, formatAcceptanceRate } from '@/lib/utils';
import { TIER_CONFIG, CONFIDENCE_CONFIG, getProbabilityColor } from './constants';
import type { PredictionResult } from './types';

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

    const tierConfig = TIER_CONFIG[result.tier];
    const confidenceConfig = CONFIDENCE_CONFIG[result.confidence];
    const TierIcon = tierConfig.icon;

    const probPercent = (result.probability * 100).toFixed(0);
    const hasExpandedContent =
      result.factors.length > 0 ||
      result.suggestions.length > 0 ||
      result.comparison ||
      result.engineScores;

    // Accuracy badge
    const accuracyBadge = result.actualResult
      ? getAccuracyBadge(result.actualResult, result.tier)
      : null;

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
                  {t(`tier.${result.tier}`)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(confidenceConfig.border, confidenceConfig.text)}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {t(`confidence.${result.confidence}`)}
                </Badge>
                {/* Accuracy badge when actual result reported */}
                {accuracyBadge && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      accuracyBadge.variant === 'accurate'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-600'
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
                {result.schoolMeta?.usNewsRank && (
                  <Badge variant="secondary" className="text-xs py-0 gap-1">
                    <Trophy className="h-3 w-3" />
                    {t('rank', { rank: result.schoolMeta.usNewsRank })}
                  </Badge>
                )}
                {result.schoolMeta?.acceptanceRate != null && (
                  <Badge variant="secondary" className="text-xs py-0">
                    {t('schoolAcceptanceRateLabel', {
                      rate: formatAcceptanceRate(result.schoolMeta.acceptanceRate).replace('%', ''),
                    })}
                  </Badge>
                )}
                {result.modelVersion && (
                  <span className="hidden sm:inline">{result.modelVersion}</span>
                )}
                {result.probabilityLow !== undefined && result.probabilityHigh !== undefined && (
                  <span>
                    {t('range')}: {(result.probabilityLow * 100).toFixed(0)}-
                    {(result.probabilityHigh * 100).toFixed(0)}%
                  </span>
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
                  aria-label={`${t('estimatedProbabilityLabel')} ${probPercent}%`}
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
                    animate={{ strokeDasharray: `${result.probability * 163.36} 163.36` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </svg>
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center text-lg font-bold text-metric rotate-0',
                    getProbabilityColor(result.probability)
                  )}
                >
                  {probPercent}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {t('estimatedProbabilityLabel')}
              </span>
            </div>
          </div>

          {/* Row 2: Data source indicators */}
          {result.engineScores && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.engineScores.stats !== undefined && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <BarChart3 className="h-3 w-3" />
                  {t('source.academic')}
                </Badge>
              )}
              {result.engineScores.ai !== undefined && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Brain className="h-3 w-3" />
                  {t('source.aiAnalysis')}
                </Badge>
              )}
              {result.engineScores.historical !== undefined && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <BookOpen className="h-3 w-3" />
                  {t('source.historicalData')}
                </Badge>
              )}
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
                <span>
                  {isExpanded ? t('collapse') : t('expand')}
                  {!isExpanded && result.factors.length > 0 && (
                    <span className="ml-1">
                      ({result.factors.length} {t('factorsCount')}
                      {result.suggestions.length > 0
                        ? `, ${result.suggestions.length} ${t('suggestionsCount')}`
                        : ''}
                      )
                    </span>
                  )}
                </span>
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
                <div className="space-y-5 pt-3">
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
                            <p className="text-xs text-muted-foreground">US News</p>
                            <p className="font-semibold text-sm">#{result.schoolMeta.usNewsRank}</p>
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
                              getProbabilityColor(result.probability)
                            )}
                          >
                            {probPercent}%
                          </p>
                        </div>
                      </div>
                      <RateBreakdownPanel
                        schoolMeta={result.schoolMeta}
                        majorBreakdown={(result as any).majorBreakdown}
                        communityInsight={(result as any).communityInsight}
                        probability={result.probability}
                        isInternational={isInternational ?? false}
                      />
                    </div>
                  )}

                  {/* Impact factors */}
                  {result.factors.length > 0 && <FactorsPanel factors={result.factors} />}

                  {/* Applicant comparison */}
                  {result.comparison && <ComparisonPanel comparison={result.comparison} />}

                  {/* Suggestions */}
                  {result.suggestions.length > 0 && (
                    <SuggestionsPanel
                      suggestions={result.suggestions}
                      dataCompleteness={dataCompleteness}
                    />
                  )}

                  {/* Prediction history trend */}
                  <PredictionHistoryPanel schoolId={result.schoolId} />

                  {/* Report actual result */}
                  <ResultFeedbackButtons
                    schoolId={result.schoolId}
                    actualResult={result.actualResult}
                    onResultReported={onResultReported}
                  />

                  {/* AI deep analysis link */}
                  <button
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('ai-assistant-action', {
                          detail: {
                            message: t('detailedAnalysisPrompt', {
                              schoolName: result.schoolName,
                            }),
                          },
                        })
                      );
                    }}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {t('detailedAnalysis')}
                  </button>
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
