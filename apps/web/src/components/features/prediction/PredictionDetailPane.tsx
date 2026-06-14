/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RankingBadge } from '@/components/ui/ranking-badge';
import {
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
import { TIER_CONFIG } from './constants';
import type { PredictionResult } from './types';
import { PredictionExplanationStream } from './PredictionExplanationStream';

// Heavy sub-panels load on demand. They live in THIS pane (a normal-flow scroll
// container) — never inside a windowed list — so their async height changes are
// absorbed by the pane's own scroll and can't disturb any sibling layout.
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
const CaseComparisonPanel = dynamic(
  () => import('./CaseComparisonPanel').then((m) => ({ default: m.CaseComparisonPanel })),
  { ssr: false }
);

interface PredictionDetailPaneProps {
  result: PredictionResult;
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

/**
 * The full analysis surface for a single predicted school. This is the COL-3
 * "detail pane" of the workbench layout — it renders all of a school's reasoning
 * (assessment, why, real cases, suggestions, history, outcome-report, feedback)
 * in normal document flow inside its own scroll column.
 *
 * It deliberately carries NO expand/collapse state and NO height animation: the
 * old fat-card expand was what broke the windowed list (variable + async +
 * animated height inside an absolute-positioned virtual item). Here the content
 * is always "open" in a dedicated pane, so that whole bug class is gone.
 */
export function PredictionDetailPane({
  result,
  onResultReported,
  onRefresh,
  isRefreshing,
  isInternational,
  dataCompleteness,
}: PredictionDetailPaneProps) {
  const t = useTranslations('prediction');

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
  const isCounselorEstimate = result.predictionMethod === 'counselor';

  const accuracyBadge = result.actualResult
    ? getAccuracyBadge(result.actualResult, result.tier)
    : null;

  return (
    <div className="space-y-4">
      {/* Header — school identity + the headline verdict */}
      <div className="rounded-[var(--theme-radius-card)] border bg-card">
        <div className={cn('h-1.5 rounded-t-[var(--theme-radius-card)]', tierConfig.bar)} />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-title font-semibold">{result.schoolName}</span>
                <Badge variant="outline" className="gap-1 border-primary/20 text-primary">
                  <Database className="h-3 w-3" />
                  {dataSupportLabel}
                </Badge>
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
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                    {t('roundContextChip', { value: humanizeMachineLabel(result.roundContext) })}
                  </Badge>
                )}
                {hasDataQualityWarning && dataQuality && (
                  <Badge variant="outline" className="text-xs py-0 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t(`dataQuality.summary.${dataQuality.summary}`)}
                  </Badge>
                )}
                {result.fromCache && (
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs py-0">
                      {result.cachedAt
                        ? t('updatedAgo', { time: getTimeAgo(result.cachedAt) })
                        : t('fromCache')}
                    </Badge>
                    {onRefresh && (
                      <button
                        onClick={() => onRefresh(result.schoolId)}
                        disabled={isRefreshing}
                        className="inline-flex items-center text-xs text-primary hover:text-primary/80 disabled:opacity-50"
                        title={t('refreshPrediction')}
                        aria-label={t('refreshPrediction')}
                      >
                        <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end text-right">
              <div className={cn('flex items-center gap-1.5', tierConfig.text)}>
                <TierIcon className="h-6 w-6 shrink-0" />
                <span className="text-2xl font-bold leading-tight">
                  {isUnavailable ? t('tier.unavailable') : t(`tier.${result.tier}`)}
                </span>
              </div>
              {!isUnavailable && probabilityRange && (
                <span className="mt-1 text-xs text-muted-foreground">
                  {t('rangeLine', { range: probabilityRange })}
                </span>
              )}
              {isUnavailable && (
                <span className="mt-1 max-w-[12rem] text-xs text-muted-foreground">
                  {t('insufficientDataReason')}
                </span>
              )}
            </div>
          </div>

          {/* Decision signals — the "key read" */}
          {(publicExplanation || result.factors.length > 0 || result.suggestions[0]) && (
            <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
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
                  {result.factors.slice(0, 3).map((factor) => (
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
              {(publicExplanation?.nextAction || result.suggestions[0]) && (
                <div className="mt-3 rounded-[var(--theme-radius-button)] border bg-background/70 px-3 py-2">
                  <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                    {t('nextAction')}
                  </p>
                  <p className="mt-1 text-sm">
                    {publicExplanation?.nextAction ?? result.suggestions[0]}
                  </p>
                </div>
              )}
              <Link
                href="/hall?tab=verified"
                className="mt-3 flex items-center gap-2 rounded-[var(--theme-radius-button)] border bg-background/70 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t('hallLink.title')}</span>
                  <span className="block text-xs text-muted-foreground">{t('hallLink.body')}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Assessment */}
      {(hasPredictionContext || isCounselorEstimate || result.schoolMeta) && (
        <PredictionDetailSection title={t('detailSections.assessment')}>
          {hasDataQualityWarning && dataQuality && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
              <p className="text-overline text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                {t('dataQuality.title')}
              </p>
              <p className="text-sm text-muted-foreground">{t('dataQuality.description')}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {t('dataQuality.official', { count: dataQuality.officialFields.length })}
                </Badge>
                {dataQuality.heuristicFields.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {t('dataQuality.heuristic', { count: dataQuality.heuristicFields.length })}
                  </Badge>
                )}
                {dataQuality.terminalFields.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {t('dataQuality.terminal', { count: dataQuality.terminalFields.length })}
                  </Badge>
                )}
                {dataQuality.staleFields.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {t('dataQuality.stale', { count: dataQuality.staleFields.length })}
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
                    <p className="text-sm font-medium">{humanizeMachineLabel(result.cohortKey)}</p>
                  </div>
                )}
                {normalizedSourceSummary.primary && (
                  <div className="space-y-1">
                    <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                      {t('sourceSummaryLabel')}
                    </p>
                    <p className="text-sm font-medium">{normalizedSourceSummary.primary}</p>
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
                      <li key={`${result.schoolId}-uncertainty-${index}`} className="flex gap-2">
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
                  <p className="text-sm text-muted-foreground">{t('counselor.disclaimerBody')}</p>
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
                          <p className="text-xs text-muted-foreground">{factor.detail}</p>
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
                  <p className="text-xs text-muted-foreground">{t('rangeLabel')}</p>
                  <p
                    className={cn(
                      'font-semibold text-sm',
                      isUnavailable ? 'text-muted-foreground' : tierConfig.text
                    )}
                  >
                    {isUnavailable ? t('tier.unavailable') : (probabilityRange ?? '—')}
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

      {/* Why this result */}
      {(publicExplanation || result.factors.length > 0 || result.comparison) && (
        <PredictionDetailSection title={t('detailSections.why')}>
          {publicExplanation && (
            <div className="space-y-3 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
              <p className="text-sm font-medium">{publicExplanation.headline}</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {publicExplanation.reasons.map((reason, index) => (
                  <li key={`${result.schoolId}-expanded-reason-${index}`} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
              {publicExplanation.caveats.length > 0 && (
                <p className="text-xs text-muted-foreground">{publicExplanation.caveats[0]}</p>
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

          {result.comparison && <ComparisonPanel comparison={result.comparison} />}
        </PredictionDetailSection>
      )}

      {/* Similar real cases */}
      <PredictionDetailSection title={t('detailSections.realCases')}>
        <CaseComparisonPanel schoolId={result.schoolId} />
      </PredictionDetailSection>

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <PredictionDetailSection title={t('detailSections.improve')}>
          <SuggestionsPanel suggestions={result.suggestions} dataCompleteness={dataCompleteness} />
        </PredictionDetailSection>
      )}

      {/* Understanding / history / report outcome / feedback */}
      <PredictionDetailSection title={t('detailSections.understanding')}>
        <PredictionHistoryPanel schoolId={result.schoolId} />

        {!isUnavailable && (
          <ResultFeedbackButtons
            schoolId={result.schoolId}
            actualResult={result.latestOutcomeLabel?.result ?? result.actualResult}
            onResultReported={onResultReported}
          />
        )}

        <PredictionFeedbackWidget predictionResultId={result.id} />

        <button
          onClick={() => {
            openFloatingAgentChat({
              message: t('detailedAnalysisPrompt', { schoolName: result.schoolName }),
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
  );
}

function PredictionDetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-background p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
