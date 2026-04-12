'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import type {
  AIAnalysisResult,
  AnalysisContextFlag,
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisFeedbackCategory,
  AnalysisState,
  SectionAnalysis,
  SubmitApplicationAnalysisFeedbackInput,
  TargetSchoolInsight,
} from '@study-abroad/shared';
import { profileRoutes } from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import { AI_TIMEOUTS, GC_TIME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SECTION_META = {
  academic: { icon: GraduationCap },
  testScores: { icon: BarChart3 },
  activities: { icon: BookOpen },
  awards: { icon: Trophy },
} as const;

const SECTION_STYLES = {
  green:
    'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  yellow:
    'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  red: 'border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
} as const;

const FRESHNESS_STYLES = {
  fresh: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cached: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  degraded: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
} as const;

interface ProfileAIAnalysisProps {
  className?: string;
  compact?: boolean;
  analysis?: AIAnalysisResult | null;
  isLoading?: boolean;
  isFetching?: boolean;
  onRefresh?: () => void;
}

export function ProfileAIAnalysis({
  className,
  compact = false,
  analysis,
  isLoading: externalLoading,
  isFetching: externalFetching,
  onRefresh,
}: ProfileAIAnalysisProps) {
  const t = useTranslations('applicationAnalysis');
  const [expanded, setExpanded] = useState(!compact);

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

  const resolvedAnalysis = analysis ?? query.data ?? null;
  const loading = shouldFetch ? query.isLoading : Boolean(externalLoading);
  const refreshing = shouldFetch ? query.isFetching : Boolean(externalFetching);

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
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t('error.retry')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resolvedAnalysis) {
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

  const state = resolvedAnalysis.meta?.state ?? 'ready';
  const stateText = getStateCopy(t, state);
  const freshness = resolvedAnalysis.status ?? 'fresh';
  const focusSchools = resolvedAnalysis.targetSchoolInsights ?? [];
  const contextFlags = resolvedAnalysis.profileContext?.contextFlags ?? [];

  return (
    <Card className={cn(className)}>
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
            <Badge className={cn('font-medium', FRESHNESS_STYLES[freshness])}>
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
                <Badge variant="outline">{stateText.label}</Badge>
                {resolvedAnalysis.meta?.dataQuality && (
                  <Badge variant="secondary">
                    {t(`dataQuality.${resolvedAnalysis.meta.dataQuality}`)}
                  </Badge>
                )}
                <Badge variant="secondary">{t(`legacyTier.${resolvedAnalysis.tier}`)}</Badge>
              </div>
              <p className="text-base font-semibold">
                {resolvedAnalysis.portfolioAnalysis?.verdict}
              </p>
              <p className="text-sm text-muted-foreground">{resolvedAnalysis.summary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl bg-background/80 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('overallScore')}
                </p>
                <p className="text-3xl font-semibold">{resolvedAnalysis.overallScore}</p>
              </div>
              <div className="w-px self-stretch bg-border" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('focusSchools')}
                </p>
                <p className="text-2xl font-semibold">{focusSchools.length}</p>
              </div>
            </div>
          </div>

          {compact && !expanded ? (
            <div className="mt-4 space-y-3">
              {resolvedAnalysis.portfolioAnalysis?.reasons.slice(0, 2).map((reason, index) => (
                <ReasonRow key={`${reason}-${index}`} text={reason} />
              ))}
              <div className="flex justify-end">
                <Button variant="link" className="h-auto p-0" onClick={() => setExpanded(true)}>
                  {t('actions.showFull')}
                </Button>
              </div>
            </div>
          ) : compact ? (
            <div className="mt-4 flex justify-end">
              <Button variant="link" className="h-auto p-0" onClick={() => setExpanded(false)}>
                {t('actions.hideFull')}
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>

      {(!compact || expanded) && (
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <SectionHeading icon={Target} title={t('profileContext')} />
            <div className="grid gap-3 md:grid-cols-2">
              <InfoCard
                label={t('applicantType.title')}
                value={t(
                  `applicantType.${resolvedAnalysis.profileContext?.applicantType ?? 'unknown'}`
                )}
              />
              <InfoCard
                label={t('testStrategy.title')}
                value={t(
                  `testStrategy.${resolvedAnalysis.profileContext?.testStrategy ?? 'unknown'}`
                )}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {contextFlags.map((flag) => (
                <Badge key={flag} variant="secondary">
                  {t(`contextFlags.${flag as AnalysisContextFlag}`)}
                </Badge>
              ))}
            </div>
            {resolvedAnalysis.profileContext?.highSchoolContext && (
              <p className="text-sm text-muted-foreground">
                {resolvedAnalysis.profileContext.highSchoolContext}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeading icon={Target} title={t('schoolListDiagnosis')} />
            <div className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {t(
                    `portfolioBalance.${resolvedAnalysis.portfolioAnalysis?.balance ?? 'insufficient'}`
                  )}
                </Badge>
                <Badge variant="secondary">{t(`states.${state}.label`)}</Badge>
              </div>
              <p className="mt-3 text-sm">{stateText.description}</p>
              <div className="mt-4 space-y-2">
                {resolvedAnalysis.portfolioAnalysis?.reasons.map((reason, index) => (
                  <ReasonRow key={`${reason}-${index}`} text={reason} />
                ))}
              </div>

              {resolvedAnalysis.portfolioAnalysis?.riskBoundaries.length ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">{t('riskBoundaries')}</p>
                  <div className="space-y-2">
                    {resolvedAnalysis.portfolioAnalysis.riskBoundaries.map((risk, index) => (
                      <ReasonRow key={`${risk}-${index}`} text={risk} icon={AlertCircle} />
                    ))}
                  </div>
                </div>
              ) : null}

              {resolvedAnalysis.portfolioAnalysis?.missingPredictionSchoolNames.length ? (
                <InlineList
                  label={t('missingPredictions')}
                  values={resolvedAnalysis.portfolioAnalysis.missingPredictionSchoolNames}
                />
              ) : null}

              {resolvedAnalysis.portfolioAnalysis?.missingRoundSchoolNames.length ? (
                <InlineList
                  label={t('missingRounds')}
                  values={resolvedAnalysis.portfolioAnalysis.missingRoundSchoolNames}
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeading icon={Target} title={t('focusSchools')} />
            {focusSchools.length > 0 ? (
              <div className="grid gap-4">
                {focusSchools.map((school) => (
                  <TargetSchoolCard
                    key={school.schoolId}
                    analysis={resolvedAnalysis}
                    school={school}
                  />
                ))}
              </div>
            ) : (
              <WeakStateCard state={state} />
            )}
          </section>

          {resolvedAnalysis.fairnessDisclosure ? (
            <section className="space-y-3">
              <SectionHeading icon={ShieldCheck} title={t('fairness.title')} />
              <div className="rounded-2xl border p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {t(`fairness.status.${resolvedAnalysis.fairnessDisclosure.status}`)}
                  </Badge>
                  {(resolvedAnalysis.meta?.experimentalVersions ?? []).map((item) => (
                    <Badge key={`${item.capability}-${item.version}`} variant="secondary">
                      {item.capability} · {item.version}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <ListCard
                    title={t('fairness.notes')}
                    items={resolvedAnalysis.fairnessDisclosure.notes}
                    compact
                  />
                  <ListCard
                    title={t('fairness.appliesTo')}
                    items={resolvedAnalysis.fairnessDisclosure.appliesTo}
                    compact
                  />
                </div>
                {resolvedAnalysis.meta?.exposureId ? (
                  <div className="mt-4">
                    <ExperimentalFeedbackCard
                      exposureId={resolvedAnalysis.meta.exposureId}
                      capability="FAIRNESS"
                    />
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionHeading icon={Lightbulb} title={t('foundationReview')} />
            <div className="grid gap-3 md:grid-cols-2">
              {(
                Object.entries(resolvedAnalysis.sections) as Array<
                  [keyof typeof SECTION_META, SectionAnalysis]
                >
              ).map(([sectionKey, section]) => (
                <SectionCard key={sectionKey} sectionKey={sectionKey} section={section} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeading icon={CheckCircle2} title={t('actionPlan.title')} />
            <div className="grid gap-3 lg:grid-cols-3">
              <PlanColumn
                title={t('actionPlan.now')}
                items={resolvedAnalysis.actionPlan?.now ?? []}
              />
              <PlanColumn
                title={t('actionPlan.next90Days')}
                items={resolvedAnalysis.actionPlan?.next90Days ?? []}
              />
              <PlanColumn
                title={t('actionPlan.beforeSubmission')}
                items={resolvedAnalysis.actionPlan?.beforeSubmission ?? []}
              />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeading icon={Sparkles} title={t('recommendations.title')} />
            <div className="grid gap-3 lg:grid-cols-2">
              <ListCard
                title={t('recommendations.majors')}
                items={
                  resolvedAnalysis.recommendedPrograms?.majors ??
                  resolvedAnalysis.suggestions.majors
                }
              />
              <ListCard
                title={t('recommendations.competitions')}
                items={
                  resolvedAnalysis.recommendedPrograms?.competitions ??
                  resolvedAnalysis.suggestions.competitions
                }
              />
              <ListCard
                title={t('recommendations.activities')}
                items={
                  resolvedAnalysis.recommendedPrograms?.activities ??
                  resolvedAnalysis.suggestions.activities
                }
              />
              <ListCard
                title={t('recommendations.summerPrograms')}
                items={
                  resolvedAnalysis.recommendedPrograms?.summerPrograms ??
                  resolvedAnalysis.suggestions.summerPrograms
                }
              />
            </div>
            <ListCard
              title={t('recommendations.timeline')}
              items={
                resolvedAnalysis.recommendedPrograms?.timeline ??
                resolvedAnalysis.suggestions.timeline
              }
            />
          </section>
        </CardContent>
      )}
    </Card>
  );
}

function TargetSchoolCard({
  analysis,
  school,
}: {
  analysis: AIAnalysisResult;
  school: TargetSchoolInsight;
}) {
  const t = useTranslations('applicationAnalysis');
  const probabilityLabel = useMemo(() => {
    if (school.predictionSnapshot?.probability == null) {
      return t('schoolCards.probabilityUnavailable');
    }
    return `${Math.round(school.predictionSnapshot.probability * 100)}%`;
  }, [school.predictionSnapshot?.probability, t]);

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{school.schoolName}</h3>
            <Badge variant="outline">{t(`schoolTier.${school.tier}`)}</Badge>
            {school.round && <Badge variant="secondary">{school.round}</Badge>}
            {school.policyContext && (
              <>
                <Badge variant="secondary">
                  {t(`policy.testing.${school.policyContext.testingPolicy}`)}
                </Badge>
                <Badge variant="secondary">
                  {t(`policy.intlAid.${school.policyContext.intlAidPolicy}`)}
                </Badge>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {t('schoolCards.probability')}:{' '}
              <span className="font-medium text-foreground">{probabilityLabel}</span>
            </span>
            {school.predictionSnapshot?.confidence && (
              <span>
                {t('schoolCards.confidence')}:{' '}
                <span className="font-medium text-foreground">
                  {t(`confidence.${school.predictionSnapshot.confidence}`)}
                </span>
              </span>
            )}
            {school.predictionSnapshot?.updatedAt && (
              <span>
                {t('schoolCards.updated')}:{' '}
                <span className="font-medium text-foreground">
                  {formatDate(school.predictionSnapshot.updatedAt)}
                </span>
              </span>
            )}
          </div>
          {school.predictionSnapshot?.confidenceReason && (
            <p className="text-sm text-muted-foreground">
              {school.predictionSnapshot.confidenceReason}
            </p>
          )}
        </div>
        <Badge variant="secondary">{analysis.meta?.analysisVersion}</Badge>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListCard title={t('schoolCards.whyHard')} items={school.whyThisIsHard} compact />
        <ListCard title={t('schoolCards.strengths')} items={school.compensatingStrengths} compact />
        <ListCard title={t('schoolCards.gaps')} items={school.topGaps} compact />
        <ListCard title={t('schoolCards.nextActions')} items={school.nextActions} compact />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ListCard title={t('schoolCards.historical')} items={school.historicalSignals} compact />
        <ListCard title={t('schoolCards.hardStops')} items={school.hardStopRisks ?? []} compact />
      </div>

      {school.recourseGuidance || school.strategyUncertainty ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <ListCard
              title={t('schoolCards.recourse')}
              items={
                school.recourseGuidance
                  ? [
                      school.recourseGuidance.goal,
                      ...school.recourseGuidance.recommendedChanges.map(
                        (item) => `${item.action}: ${item.rationale}`
                      ),
                      ...school.recourseGuidance.constraints,
                      school.recourseGuidance.whyNotGuaranteed,
                    ]
                  : []
              }
              compact
            />
            {analysis.meta?.exposureId && school.recourseGuidance ? (
              <ExperimentalFeedbackCard
                exposureId={analysis.meta.exposureId}
                capability="RECOURSE"
                schoolId={school.schoolId}
              />
            ) : null}
          </div>
          <div className="space-y-3">
            <ListCard
              title={t('schoolCards.uncertainty')}
              items={
                school.strategyUncertainty
                  ? [
                      `${t('schoolCards.uncertaintyRange')}: ${
                        school.strategyUncertainty.probabilityLow != null
                          ? `${Math.round(school.strategyUncertainty.probabilityLow * 100)}%`
                          : '—'
                      } - ${
                        school.strategyUncertainty.probabilityHigh != null
                          ? `${Math.round(school.strategyUncertainty.probabilityHigh * 100)}%`
                          : '—'
                      }`,
                      ...school.strategyUncertainty.reasons,
                    ]
                  : []
              }
              compact
            />
            {analysis.meta?.exposureId && school.strategyUncertainty ? (
              <ExperimentalFeedbackCard
                exposureId={analysis.meta.exposureId}
                capability="UNCERTAINTY"
                schoolId={school.schoolId}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const FEEDBACK_CATEGORY_KEYS: Record<
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisFeedbackCategory[]
> = {
  RECOURSE: ['UNSAFE_RECOURSE', 'POLICY_MISMATCH', 'LOW_ACTIONABILITY'],
  UNCERTAINTY: ['MISLEADING_UNCERTAINTY', 'POLICY_MISMATCH', 'LOW_ACTIONABILITY'],
  FAIRNESS: ['FAIRNESS_CONCERN', 'POLICY_MISMATCH', 'LOW_ACTIONABILITY'],
};

function ExperimentalFeedbackCard({
  exposureId,
  capability,
  schoolId,
}: {
  exposureId: string;
  capability: ApplicationAnalysisExperimentCapability;
  schoolId?: string;
}) {
  const t = useTranslations('applicationAnalysis');
  const [submitted, setSubmitted] = useState(false);
  const [showNegativeCategories, setShowNegativeCategories] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: SubmitApplicationAnalysisFeedbackInput) =>
      apiClient.post(profileRoutes.aiAnalysisFeedback(), payload, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess: () => {
      setSubmitted(true);
      setShowNegativeCategories(false);
    },
  });

  if (submitted) {
    return (
      <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        {t('feedback.submitted')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed p-3">
      <p className="text-sm font-medium">{t('feedback.title')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              exposureId,
              capability,
              schoolId,
              sentiment: 'HELPFUL',
            })
          }
        >
          <ThumbsUp className="mr-2 h-4 w-4" />
          {t('feedback.helpful')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => setShowNegativeCategories((value) => !value)}
        >
          <ThumbsDown className="mr-2 h-4 w-4" />
          {t('feedback.notHelpful')}
        </Button>
      </div>

      {showNegativeCategories ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('feedback.chooseReason')}
          </p>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_CATEGORY_KEYS[capability].map((category) => (
              <Button
                key={category}
                type="button"
                variant="secondary"
                size="sm"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    exposureId,
                    capability,
                    schoolId,
                    sentiment: 'NOT_HELPFUL',
                    category,
                  })
                }
              >
                {t(`feedback.categories.${category}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({
  sectionKey,
  section,
}: {
  sectionKey: keyof typeof SECTION_META;
  section: SectionAnalysis;
}) {
  const t = useTranslations('applicationAnalysis');
  const Icon = SECTION_META[sectionKey].icon;

  return (
    <div className={cn('rounded-2xl border p-4', SECTION_STYLES[section.status])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <p className="font-medium">{t(`sections.${sectionKey}`)}</p>
        </div>
        <Badge variant="outline">{t(`sectionStatus.${section.status}`)}</Badge>
      </div>
      <p className="mt-3 text-2xl font-semibold">{section.score}/10</p>
      <p className="mt-2 text-sm">{section.feedback}</p>
      {section.highlights?.length ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide opacity-70">{t('highlights')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {section.highlights.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {section.improvements?.length ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide opacity-70">{t('improvements')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {section.improvements.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-2">
                <span className="mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PlanColumn({ title, items }: { title: string; items: string[] }) {
  return <ListCard title={title} items={items} />;
}

function ListCard({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  const t = useTranslations('applicationAnalysis');

  return (
    <div className="rounded-2xl border p-4">
      <p className="font-medium">{title}</p>
      {items.length > 0 ? (
        <ul className={cn('mt-3 space-y-2 text-sm', compact && 'space-y-1.5')}>
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="mt-0.5 text-muted-foreground">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t('emptyList')}</p>
      )}
    </div>
  );
}

function InlineList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function WeakStateCard({ state }: { state: AnalysisState }) {
  const t = useTranslations('applicationAnalysis');
  const copy = getStateCopy(t, state);

  return (
    <div className="rounded-2xl border border-dashed p-5 text-sm">
      <p className="font-medium">{copy.label}</p>
      <p className="mt-2 text-muted-foreground">{copy.description}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  );
}

function ReasonRow({
  text,
  icon: Icon = CheckCircle2,
}: {
  text: string;
  icon?: typeof CheckCircle2;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-primary" />
      <span>{text}</span>
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof Target; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function getStateCopy(t: (key: string) => string, state: AnalysisState) {
  return {
    label: t(`states.${state}.label`),
    description: t(`states.${state}.description`),
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
