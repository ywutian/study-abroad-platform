'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  AIAnalysisResult,
  AnalysisContextFlag,
  AnalysisState,
  ApplicationAnalysisSchoolResult,
} from '@study-abroad/shared';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import { AI_TIMEOUTS, GC_TIME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FRESHNESS_STYLES = {
  fresh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cached: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  degraded: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
} as const;

interface ProfileAIAnalysisProps {
  className?: string;
  analysis?: AIAnalysisResult | null;
  isLoading?: boolean;
  isFetching?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

export function ProfileAIAnalysis({
  className,
  analysis,
  isLoading: externalLoading,
  isFetching: externalFetching,
  onRefresh,
  compact = false,
}: ProfileAIAnalysisProps) {
  const t = useTranslations('applicationAnalysis');
  const shouldFetch = analysis === undefined;
  const query = useQuery({
    queryKey: ['profile-ai-analysis'],
    queryFn: () =>
      apiClient.get<AIAnalysisResult>(profileRoutes.aiAnalysis(), {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    staleTime: STALE_TIME.MODERATE,
    gcTime: GC_TIME.AI_ANALYSIS,
    enabled: shouldFetch,
  });

  const resolved = analysis ?? query.data ?? null;
  const loading = shouldFetch ? query.isLoading : Boolean(externalLoading);
  const refreshing = shouldFetch ? query.isFetching : Boolean(externalFetching);
  const [feedbackState, setFeedbackState] = useState<'HELPFUL' | 'NOT_HELPFUL' | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (sentiment: 'HELPFUL' | 'NOT_HELPFUL') =>
      apiClient.post(
        profileRoutes.aiAnalysisFeedback(),
        {
          runId: resolved?.meta.runId,
          sentiment,
          category: sentiment === 'NOT_HELPFUL' ? 'LOW_ACTIONABILITY' : undefined,
        },
        {
          timeout: 15000,
          directApi: true,
        }
      ),
    onSuccess: (_, sentiment) => {
      setFeedbackState(sentiment);
    },
  });

  const refresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    if (shouldFetch) {
      void query.refetch();
    }
  };

  if (loading) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('loading.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              </div>
              <div>
                <p className="font-medium">{t('loading.title')}</p>
                <p className="text-sm text-muted-foreground">{t('loading.description')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (shouldFetch && query.isError) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-destructive" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('error.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-destructive/30 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-destructive/10 p-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{t('error.title')}</p>
                <p className="text-sm text-muted-foreground">{t('error.description')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t('error.retry')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resolved) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('empty.title')}</p>
            <p className="mt-2">{t('empty.description')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (
    !resolved.meta ||
    !resolved.profileSummary ||
    !resolved.portfolioSummary ||
    !resolved.actionPlan
  ) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('empty.title')}</p>
            <p className="mt-2">{t('empty.description')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const freshness = resolved.status ?? 'fresh';
  const state = resolved.meta.state ?? 'ready';
  const overallVerdict = resolved.overallVerdict?.trim()
    ? resolved.overallVerdict
    : resolved.portfolioSummary.verdict;
  const focusSchools = resolved.schoolCards?.length > 0 ? resolved.schoolCards : resolved.schools;
  const topReasons =
    resolved.topReasons?.length > 0 ? resolved.topReasons : resolved.portfolioSummary.keyReasons;
  const topRisks =
    resolved.topRisks?.length > 0 ? resolved.topRisks : resolved.portfolioSummary.riskBoundaries;
  const nextActions =
    resolved.nextActions?.length > 0 ? resolved.nextActions : resolved.actionPlan.now;
  const confidenceSummary =
    resolved.confidenceSummary?.summary ?? t(`dataQuality.${resolved.meta.dataQuality}`);
  const freshnessSummary = resolved.freshnessSummary?.summary ?? t(`freshness.${freshness}`);
  const evidenceItems = resolved.evidenceSummary?.map((item) => `${item.label}: ${item.detail}`);

  const summaryOnly = compact;

  return (
    <Card className={cn(className)} data-testid="analysis-root" data-state={state}>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              {t('title')}
              <Sparkles className="h-4 w-4 text-primary" />
            </CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn('font-medium', FRESHNESS_STYLES[freshness])}
              data-testid="analysis-freshness-badge"
            >
              {t(`freshness.${freshness}`)}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={refreshing}
              aria-label={t('actions.refresh')}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-primary/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" data-testid="analysis-state-badge">
                  {getStateCopy(t, state).label}
                </Badge>
                <Badge variant="secondary">{t(`dataQuality.${resolved.meta.dataQuality}`)}</Badge>
                <Badge variant="secondary">{resolved.meta.analysisVersion}</Badge>
              </div>
              <p className="text-base font-semibold" data-testid="analysis-overall-verdict">
                {overallVerdict}
              </p>
              {resolved.meta.degradedReason ? (
                <p className="text-sm text-muted-foreground">{resolved.meta.degradedReason}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl bg-background/80 px-4 py-3">
              <MetricBlock
                label={t('focusSchools')}
                value={String(focusSchools.length)}
                icon={<Target className="h-4 w-4 text-primary" />}
              />
              <MetricBlock
                label={t('trace')}
                value={resolved.meta.traceId.slice(0, 8)}
                icon={<Clock3 className="h-4 w-4 text-primary" />}
                valueTestId="analysis-trace-id"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-6', summaryOnly && 'space-y-4')}>
        <section className="space-y-3" data-testid="analysis-section-profileContext">
          <SectionHeading icon={ShieldCheck} title={t('profileContext')} />
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard
              label={t('applicantType.title')}
              value={t(`applicantType.${resolved.profileSummary.applicantType}`)}
            />
            <InfoCard
              label={t('testStrategy.title')}
              value={t(`testStrategy.${resolved.profileSummary.testStrategy ?? 'unknown'}`)}
            />
          </div>
          {resolved.profileSummary.intendedMajors.length ? (
            <div className="flex flex-wrap gap-2">
              {resolved.profileSummary.intendedMajors.map((major, index) => (
                <Badge key={`${major}-${index}`} variant="outline">
                  {major}
                </Badge>
              ))}
            </div>
          ) : null}
          {resolved.profileSummary.contextFlags.length ? (
            <div className="flex flex-wrap gap-2">
              {resolved.profileSummary.contextFlags.map((flag, index) => (
                <Badge key={`${flag}-${index}`} variant="secondary">
                  {t(`contextFlags.${flag as AnalysisContextFlag}`)}
                </Badge>
              ))}
            </div>
          ) : null}
          {resolved.profileSummary.constraints.length ? (
            <ListCard
              title={t('riskBoundaries')}
              items={resolved.profileSummary.constraints}
              compact
              testId="analysis-profile-constraints"
            />
          ) : null}
          {resolved.profileSummary.highSchoolContext ? (
            <p className="text-sm text-muted-foreground">
              {resolved.profileSummary.highSchoolContext}
            </p>
          ) : null}
        </section>

        <section className="space-y-3" data-testid="analysis-section-schoolListDiagnosis">
          <SectionHeading icon={CheckCircle2} title={t('schoolListDiagnosis')} />
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {t(`portfolioBalance.${resolved.portfolioSummary.balance}`)}
            </Badge>
            <Badge variant="secondary">{getStateCopy(t, state).label}</Badge>
          </div>
          <ListCard
            title={t('topReasons')}
            items={topReasons}
            compact
            testId="analysis-top-reasons"
          />
          <ListCard title={t('topRisks')} items={topRisks} compact testId="analysis-top-risks" />
          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard
              label={t('confidenceSummary')}
              value={confidenceSummary}
              testId="analysis-confidence-summary"
            />
            <InfoCard
              label={t('freshnessSummary')}
              value={freshnessSummary}
              testId="analysis-freshness-summary"
            />
          </div>
          {evidenceItems?.length ? (
            <ListCard
              title={t('evidenceSummary')}
              items={evidenceItems}
              compact
              testId="analysis-evidence-summary"
            />
          ) : null}
        </section>

        {summaryOnly ? (
          <>
            <section className="space-y-3" data-testid="analysis-section-focusSchools">
              <SectionHeading icon={Target} title={t('focusSchools')} />
              <ListCard
                title={t('focusSchools')}
                items={focusSchools.map((school) => {
                  const probability =
                    school.prediction?.probability != null
                      ? `${Math.round(school.prediction.probability * 100)}%`
                      : t('schoolCards.probabilityUnavailable');
                  return `${school.schoolName} · ${t(`schoolTier.${school.tier}`)} · ${probability}`;
                })}
                compact
                testId="analysis-focus-schools"
              />
            </section>

            <section className="space-y-3" data-testid="analysis-section-actionPlan">
              <SectionHeading icon={CheckCircle2} title={t('actionPlan.title')} />
              <ListCard
                title={t('actionPlan.now')}
                items={nextActions}
                compact
                testId="analysis-next-actions"
              />
            </section>
          </>
        ) : (
          <>
            <section className="space-y-3" data-testid="analysis-section-focusSchools">
              <SectionHeading icon={Target} title={t('focusSchools')} />
              {focusSchools.length ? (
                <div className="space-y-4">
                  {focusSchools.map((school) => (
                    <FocusSchoolCard key={school.schoolId} school={school} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  {getStateCopy(t, state).description}
                </div>
              )}
            </section>

            <section className="space-y-3" data-testid="analysis-section-actionPlan">
              <SectionHeading icon={CheckCircle2} title={t('actionPlan.title')} />
              <div className="grid gap-4 lg:grid-cols-3">
                <ListCard
                  title={t('actionPlan.now')}
                  items={nextActions}
                  testId="analysis-next-actions"
                />
                <ListCard
                  title={t('actionPlan.next90Days')}
                  items={resolved.actionPlan.next90Days}
                  testId="analysis-next-90-days"
                />
                <ListCard
                  title={t('actionPlan.beforeSubmission')}
                  items={resolved.actionPlan.beforeSubmission}
                  testId="analysis-before-submission"
                />
              </div>
            </section>
          </>
        )}

        {resolved.unknowns.length ? (
          <section className="space-y-3" data-testid="analysis-section-unknowns">
            <SectionHeading icon={AlertTriangle} title={t('unknowns')} />
            <ListCard
              title={t('unknowns')}
              items={resolved.unknowns}
              compact
              testId="analysis-unknowns"
            />
          </section>
        ) : null}

        {resolved.meta.runId ? (
          <section className="space-y-3" data-testid="analysis-section-feedback">
            <SectionHeading icon={Sparkles} title={t('feedback.title')} />
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 p-4">
              <Button
                type="button"
                variant={feedbackState === 'HELPFUL' ? 'default' : 'outline'}
                size="sm"
                disabled={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate('HELPFUL')}
              >
                {t('feedback.helpful')}
              </Button>
              <Button
                type="button"
                variant={feedbackState === 'NOT_HELPFUL' ? 'default' : 'outline'}
                size="sm"
                disabled={feedbackMutation.isPending}
                onClick={() => feedbackMutation.mutate('NOT_HELPFUL')}
              >
                {t('feedback.notHelpful')}
              </Button>
              {feedbackState ? (
                <p className="text-sm text-muted-foreground">{t('feedback.submitted')}</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FocusSchoolCard({ school }: { school: ApplicationAnalysisSchoolResult }) {
  const t = useTranslations('applicationAnalysis');
  const probabilityLabel =
    school.prediction?.probability != null
      ? `${Math.round(school.prediction.probability * 100)}%`
      : t('schoolCards.probabilityUnavailable');

  return (
    <div
      className="rounded-2xl border p-4"
      data-testid="analysis-school-card"
      data-school-id={school.schoolId}
      data-school-name={school.schoolName}
      data-school-tier={school.tier}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{school.schoolName}</h3>
            <Badge variant="outline">{t(`schoolTier.${school.tier}`)}</Badge>
            {school.round ? <Badge variant="secondary">{school.round}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{school.assessment.summary}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {t('schoolCards.probability')}:{' '}
              <span className="font-medium text-foreground">{probabilityLabel}</span>
            </span>
            {school.prediction?.confidence ? (
              <span>
                {t('schoolCards.confidence')}:{' '}
                <span className="font-medium text-foreground">
                  {t(`confidence.${school.prediction.confidence}`)}
                </span>
              </span>
            ) : null}
            {school.prediction?.updatedAt ? (
              <span>
                {t('schoolCards.updated')}:{' '}
                <span className="font-medium text-foreground">
                  <span data-testid={`analysis-school-updated-at-${school.schoolId}`}>
                    {formatDate(school.prediction.updatedAt)}
                  </span>
                </span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            data-testid="analysis-testing-policy"
            data-policy={school.policyCard.testingPolicy}
          >
            {t(`policy.testing.${school.policyCard.testingPolicy}`)}
          </Badge>
          <Badge variant="secondary">
            {t(`policy.intlAid.${school.policyCard.intlAidPolicy}`)}
          </Badge>
          <Badge variant="secondary">{school.policyCard.roundContext}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListCard
          title={t('schoolCards.whyHard')}
          items={school.assessment.whyThisIsHard}
          compact
        />
        <ListCard
          title={t('schoolCards.strengths')}
          items={school.assessment.compensatingStrengths}
          compact
        />
        <ListCard title={t('schoolCards.gaps')} items={school.assessment.topGaps} compact />
        <ListCard
          title={t('schoolCards.nextActions')}
          items={school.assessment.nextActions}
          compact
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListCard
          title={t('schoolCards.historical')}
          items={school.assessment.historicalSignals}
          compact
        />
        <ListCard
          title={t('schoolCards.hardStops')}
          items={school.assessment.hardStopRisks}
          compact
        />
      </div>

      {(school.recourse || school.uncertainty || school.policyCard.standardDeadline) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ListCard
            title={t('schoolCards.recourse')}
            items={
              school.recourse
                ? [
                    school.recourse.goal,
                    ...school.recourse.recommendedChanges.map(
                      (item) => `${item.action}: ${item.rationale}`
                    ),
                    ...school.recourse.constraints,
                    school.recourse.whyNotGuaranteed,
                  ]
                : school.policyCard.standardDeadline
                  ? [`Deadline: ${school.policyCard.standardDeadline}`]
                  : []
            }
            compact
          />
          <ListCard
            title={t('schoolCards.uncertainty')}
            items={
              school.uncertainty
                ? [
                    `${t('schoolCards.uncertaintyRange')}: ${
                      school.uncertainty.probabilityLow != null
                        ? `${Math.round(school.uncertainty.probabilityLow * 100)}%`
                        : '—'
                    } - ${
                      school.uncertainty.probabilityHigh != null
                        ? `${Math.round(school.uncertainty.probabilityHigh * 100)}%`
                        : '—'
                    }`,
                    ...school.uncertainty.reasons,
                  ]
                : school.unknowns
            }
            compact
          />
        </div>
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof ShieldCheck; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-base font-semibold">{title}</h3>
    </div>
  );
}

function ListCard({
  title,
  items,
  compact = false,
  testId,
}: {
  title: string;
  items: string[];
  compact?: boolean;
  testId?: string;
}) {
  const t = useTranslations('applicationAnalysis');

  return (
    <div className="rounded-xl border bg-muted/20 p-4" data-testid={testId}>
      <p className="text-sm font-medium">{title}</p>
      <ul className={cn('mt-3 space-y-2 text-sm', compact && 'space-y-1.5')}>
        {items.length ? (
          items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2 text-muted-foreground">
              <span className="mt-0.5 text-foreground">•</span>
              <span>{item}</span>
            </li>
          ))
        ) : (
          <li className="text-muted-foreground">{t('emptyList')}</li>
        )}
      </ul>
    </div>
  );
}

function InfoCard({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  icon,
  valueTestId,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  valueTestId?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/10 p-2">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-semibold" data-testid={valueTestId}>
          {value}
        </p>
      </div>
    </div>
  );
}

function getStateCopy(t: ReturnType<typeof useTranslations>, state: AnalysisState) {
  return {
    label: t(`states.${state}.label`),
    description: t(`states.${state}.description`),
  };
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}
