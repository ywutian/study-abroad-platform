'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  API_ROUTES,
  profileRoutes,
  recommendationRoutes,
  schoolListRoutes,
  type RecommendationPreflight,
  type RecommendationResult,
} from '@study-abroad/shared';
import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';
import type { TimelineResponse } from '@/types/timeline';

import type {
  AIAnalysis,
  Profile,
  SchoolListItem,
  TieredRecommendations,
  SchoolRecommendation,
} from './_components/types';
import {
  buildApplicationWorkspaceModel,
  type ApplicationWorkspaceModel,
  type HealthCheck,
  type ReadinessSignal,
  type SchoolApplicationRow,
  type WorkspaceAction,
} from './_components/application-workspace-model';
import { tierConfig } from './_components/constants';

const PROFILE_ANALYSIS_KEY = ['profile-ai-analysis'] as const;

type TFunction = (key: string, values?: Record<string, string | number>) => string;

export default function UncommonAppPage() {
  const t = useTranslations('uncommonApp');
  const queryClient = useQueryClient();

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(
    () => queryClient.getQueryData<AIAnalysis>(PROFILE_ANALYSIS_KEY) ?? null
  );
  const [generatedRecommendations, setGeneratedRecommendations] =
    useState<TieredRecommendations | null>(null);

  const { data: schoolList, isLoading: listLoading } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<SchoolListItem[]>(schoolListRoutes.list()),
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<Profile>(profileRoutes.me()),
  });

  const { data: timelines, isLoading: timelinesLoading } = useQuery({
    queryKey: ['timelines'],
    queryFn: () => apiClient.get<TimelineResponse[]>(API_ROUTES.TIMELINES),
  });

  const { data: recommendationPreflight } = useQuery<RecommendationPreflight>({
    queryKey: ['recommendation', 'preflight'],
    queryFn: () => apiClient.get(recommendationRoutes.preflight()),
  });

  const { data: recommendationHistory } = useQuery<RecommendationResult[]>({
    queryKey: ['recommendation', 'history'],
    queryFn: () => apiClient.get(recommendationRoutes.history()),
  });

  const latestRecommendations =
    generatedRecommendations ?? toTieredRecommendations(recommendationHistory?.[0]);

  const workspace = useMemo(() => {
    return buildApplicationWorkspaceModel({
      profile,
      schoolList,
      timelines,
      analysis,
      recommendations: latestRecommendations,
    });
  }, [profile, schoolList, timelines, analysis, latestRecommendations]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(schoolListRoutes.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      queryClient.invalidateQueries({ queryKey: PROFILE_ANALYSIS_KEY });
      setAnalysis(null);
      toast.success(t('removedFromList'));
    },
  });

  const profileAnalysisMutation = useMutation({
    mutationFn: () =>
      apiClient.get<AIAnalysis>(profileRoutes.aiAnalysis(), {
        timeout: AI_TIMEOUTS.AI_REQUEST,
        directApi: true,
      }),
    onSuccess: (response) => {
      setAnalysis(response);
      queryClient.setQueryData(PROFILE_ANALYSIS_KEY, response);
      toast.success(t('analysisComplete'));
    },
    onError: () => {
      toast.error(t('analysisError'));
    },
  });

  const recommendationsMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RecommendationResult>(
        recommendationRoutes.generate(),
        {
          schoolCount: 8,
          additionalPreferences:
            'Build a balanced application portfolio with reach, match, and safety options.',
        },
        {
          timeout: AI_TIMEOUTS.AI_REQUEST,
          directApi: true,
        }
      ),
    onSuccess: (response) => {
      setGeneratedRecommendations(toTieredRecommendations(response));
      queryClient.invalidateQueries({ queryKey: ['recommendation', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['recommendation', 'preflight'] });
      toast.success(t('recommendationsLoaded'));
    },
    onError: () => {
      toast.error(t('recommendationsError'));
    },
  });

  const syncRequirementsMutation = useMutation({
    mutationFn: (schoolIds: string[]) =>
      apiClient.post(`${API_ROUTES.TIMELINES}/generate`, { schoolIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      toast.success(t('workspace.syncSuccess'));
    },
    onError: () => {
      toast.error(t('workspace.syncError'));
    },
  });

  const isLoading = profileLoading || listLoading || timelinesLoading;
  const isAnalyzing = profileAnalysisMutation.isPending;
  const isSyncing = syncRequirementsMutation.isPending;
  const isGeneratingRecommendations = recommendationsMutation.isPending;

  const handleAction = (action: WorkspaceAction) => {
    if (action.intent === 'analysis') {
      profileAnalysisMutation.mutate();
      return;
    }
    if (action.intent === 'recommendations') {
      handleGenerateRecommendations();
      return;
    }
    if (action.intent === 'sync') {
      const schoolIds = (schoolList ?? []).map((item) => item.schoolId);
      if (schoolIds.length === 0) {
        toast.error(t('workspace.noSchoolsToSync'));
        return;
      }
      syncRequirementsMutation.mutate(schoolIds);
    }
  };

  const handleGenerateRecommendations = () => {
    if (recommendationPreflight && !recommendationPreflight.canGenerate) {
      toast.error(t('recommendationsBlocked'));
      return;
    }
    recommendationsMutation.mutate();
  };

  return (
    <AIErrorBoundary feature="uncommon-app">
      <PageContainer maxWidth="7xl">
        <PageHeader
          title={t('title')}
          description={t('description')}
          icon={ClipboardList}
          color="blue"
          actions={
            <WorkspaceActionButton
              t={t}
              action={workspace.nextAction}
              onAction={handleAction}
              isBusy={isAnalyzing || isSyncing || isGeneratingRecommendations}
              size="default"
            />
          }
        />

        <div className="space-y-5">
          <ApplicationNextActionBar
            t={t}
            workspace={workspace}
            isLoading={isLoading}
            isBusy={isAnalyzing || isSyncing || isGeneratingRecommendations}
            onAction={handleAction}
          />

          <ApplicationReadinessStrip t={t} signals={workspace.readiness} isLoading={isLoading} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <ApplicationSchoolBoard
                t={t}
                workspace={workspace}
                isLoading={isLoading}
                isSyncing={isSyncing}
                onAction={handleAction}
                onDelete={(id) => deleteMutation.mutate(id)}
              />

              <AdvisorSummaryCard
                t={t}
                analysis={analysis}
                workspace={workspace}
                recommendations={latestRecommendations}
                isAnalyzing={isAnalyzing}
                isGeneratingRecommendations={isGeneratingRecommendations}
                onAction={handleAction}
              />
            </div>

            <ApplicationHealthPanel
              t={t}
              checks={workspace.healthChecks}
              isLoading={isLoading}
              isSyncing={isSyncing}
              onAction={handleAction}
            />
          </div>
        </div>
      </PageContainer>
    </AIErrorBoundary>
  );
}

function ApplicationNextActionBar({
  t,
  workspace,
  isLoading,
  isBusy,
  onAction,
}: {
  t: TFunction;
  workspace: ApplicationWorkspaceModel;
  isLoading: boolean;
  isBusy: boolean;
  onAction: (action: WorkspaceAction) => void;
}) {
  if (isLoading) {
    return <Skeleton className="h-24 rounded-[var(--theme-radius-card)]" />;
  }

  return (
    <Card className="border-primary/25 bg-[color:var(--theme-card-bg)]">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] border bg-muted">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t(`workspace.nextAction.${workspace.nextAction.id}.title`)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(`workspace.nextAction.${workspace.nextAction.id}.description`, {
                profileScore: workspace.profileScore,
                schoolCount: workspace.schoolCount,
                safetyCount: workspace.tierCounts.safety,
                missingTimelineCount: workspace.missingTimelineCount,
                missingEssayCount: workspace.missingEssayCount,
                dueSoonCount: workspace.dueSoonCount,
                overdueCount: workspace.overdueCount,
              })}
            </p>
          </div>
        </div>
        <WorkspaceActionButton
          t={t}
          action={workspace.nextAction}
          onAction={onAction}
          isBusy={isBusy}
          size="sm"
        />
      </CardContent>
    </Card>
  );
}

function ApplicationReadinessStrip({
  t,
  signals,
  isLoading,
}: {
  t: TFunction;
  signals: ReadinessSignal[];
  isLoading: boolean;
}) {
  const icons = {
    profile: UserRound,
    schools: GraduationCap,
    essays: FileText,
    deadlines: CalendarClock,
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {signals.map((signal) => {
        const Icon = icons[signal.id];
        return (
          <Card key={signal.id} className={cn(statusBorder(signal.status))}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] bg-muted">
                  <Icon className={cn('h-4 w-4', statusText(signal.status))} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t(`workspace.readiness.${signal.id}`)}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {t(`workspace.readinessHint.${signal.id}`)}
                  </p>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-xl font-semibold">{signal.value}</span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ApplicationSchoolBoard({
  t,
  workspace,
  isLoading,
  isSyncing,
  onAction,
  onDelete,
}: {
  t: TFunction;
  workspace: ApplicationWorkspaceModel;
  isLoading: boolean;
  isSyncing: boolean;
  onAction: (action: WorkspaceAction) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('workspace.schoolBoard.title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('workspace.schoolBoard.description')}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/schools">
              <Plus className="h-4 w-4" />
              {t('addSchool')}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-28 rounded-[var(--theme-radius-card)]" />
            ))}
          </div>
        ) : workspace.schoolApplications.length === 0 ? (
          <ApplicationEmptyState t={t} />
        ) : (
          <div className="space-y-3">
            {workspace.schoolApplications.map((row) => (
              <ApplicationSchoolRow
                key={row.id}
                t={t}
                row={row}
                isSyncing={isSyncing}
                onAction={onAction}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicationSchoolRow({
  t,
  row,
  isSyncing,
  onAction,
  onDelete,
}: {
  t: TFunction;
  row: SchoolApplicationRow;
  isSyncing: boolean;
  onAction: (action: WorkspaceAction) => void;
  onDelete: (id: string) => void;
}) {
  const tier = tierConfig[row.tier];
  const TierIcon = tier.icon;
  const action = actionFromNextStep(row.nextStep);

  return (
    <div className="rounded-[var(--theme-radius-card)] border bg-background p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">{row.schoolName}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className={cn('gap-1', tier.badgeClass)}>
                  <TierIcon className="h-3 w-3" />
                  {t(`tier.${row.tier.toLowerCase()}`)}
                </Badge>
                {row.tierIsOverridden && row.predictedTier && (
                  <Badge variant="outline" className="gap-1 text-2xs">
                    {t('workspace.schoolBoard.predictedHint', {
                      tier: t(`tier.${row.predictedTier.toLowerCase()}`),
                    })}
                  </Badge>
                )}
                <span>{row.round}</span>
                <span>{deadlineLabel(t, row)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(row.id)}
              aria-label={t('workspace.schoolBoard.removeSchool', { school: row.schoolName })}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <StatusChip
              icon={ClipboardCheck}
              label={t('workspace.schoolBoard.materials')}
              value={
                row.hasTimeline
                  ? t('workspace.schoolBoard.tasksRemaining', { count: row.tasksRemaining })
                  : t('workspace.schoolBoard.needTimeline')
              }
              status={row.hasTimeline ? 'good' : 'warning'}
            />
            <StatusChip
              icon={FileText}
              label={t('workspace.schoolBoard.essays')}
              value={
                row.essayPromptCount > 0
                  ? t('workspace.schoolBoard.essayCount', { count: row.essayPromptCount })
                  : t('workspace.schoolBoard.noEssayData')
              }
              status={row.essayPromptCount > 0 ? 'good' : 'warning'}
            />
            <StatusChip
              icon={BarChart3}
              label={t('workspace.schoolBoard.estimate')}
              value={
                row.predictionProbability === null
                  ? t('workspace.schoolBoard.noEstimate')
                  : t(`tier.${row.tier.toLowerCase()}`)
              }
              status={row.predictionProbability === null ? 'warning' : 'good'}
            />
            <StatusChip
              icon={CalendarClock}
              label={t('workspace.schoolBoard.deadline')}
              value={deadlineShortLabel(t, row)}
              status={
                row.urgency === 'overdue' ? 'risk' : row.urgency === 'due7' ? 'warning' : 'good'
              }
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-[var(--theme-radius-card)] border bg-muted/20 p-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t('workspace.schoolBoard.nextStepLabel')}
            </p>
            <p className="mt-1 text-sm font-medium">
              {t(`workspace.schoolBoard.nextStep.${row.nextStep}`)}
            </p>
          </div>
          <WorkspaceActionButton
            t={t}
            action={action}
            onAction={onAction}
            isBusy={isSyncing && action.intent === 'sync'}
            size="sm"
            className="w-full"
            labelKey={`workspace.schoolBoard.nextStepAction.${row.nextStep}`}
          />
        </div>
      </div>
    </div>
  );
}

function ApplicationEmptyState({ t }: { t: TFunction }) {
  const steps = [
    {
      id: 'add-schools',
      action: { id: 'add-schools', href: '/schools', intent: 'navigate' } satisfies WorkspaceAction,
    },
    {
      id: 'complete-profile',
      action: {
        id: 'complete-profile',
        href: '/profile',
        intent: 'navigate',
      } satisfies WorkspaceAction,
    },
  ];

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-dashed p-6">
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map(({ id, action }) => (
          <div key={id} className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-4">
            <p className="text-sm font-semibold">{t(`workspace.empty.${id}.title`)}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(`workspace.empty.${id}.description`)}
            </p>
            <WorkspaceActionButton
              t={t}
              action={action}
              onAction={() => undefined}
              isBusy={false}
              size="sm"
              className="mt-4"
            />
          </div>
        ))}
        <div className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-4">
          <p className="text-sm font-semibold">{t('workspace.empty.sync-requirements.title')}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('workspace.empty.sync-requirements.description')}
          </p>
          <Button className="mt-4" size="sm" variant="outline" disabled>
            <ArrowRight className="h-4 w-4" />
            {t('workspace.actions.sync-requirements')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApplicationHealthPanel({
  t,
  checks,
  isLoading,
  isSyncing,
  onAction,
}: {
  t: TFunction;
  checks: HealthCheck[];
  isLoading: boolean;
  isSyncing: boolean;
  onAction: (action: WorkspaceAction) => void;
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-24">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t('workspace.health.title')}
        </CardTitle>
        <CardDescription>{t('workspace.health.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading
          ? [0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 rounded-[var(--theme-radius-card)]" />
            ))
          : checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  'rounded-[var(--theme-radius-card)] border p-3',
                  statusBg(check.status)
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {t(`workspace.health.${check.id}.title`)}
                    </p>
                    <Badge className="mt-2" variant={badgeVariant(check.status)}>
                      {t(`workspace.healthStatus.${check.status}`)}
                    </Badge>
                  </div>
                  {check.status === 'good' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className={cn('mt-0.5 h-5 w-5', statusText(check.status))} />
                  )}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {healthDescription(t, check)}
                </p>
                {check.status !== 'good' ? (
                  <WorkspaceActionButton
                    t={t}
                    action={check.action}
                    onAction={onAction}
                    isBusy={isSyncing && check.action.intent === 'sync'}
                    size="sm"
                    variant="outline"
                    className="mt-3"
                  />
                ) : null}
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

function AdvisorSummaryCard({
  t,
  analysis,
  workspace,
  recommendations,
  isAnalyzing,
  isGeneratingRecommendations,
  onAction,
}: {
  t: TFunction;
  analysis: AIAnalysis | null;
  workspace: ApplicationWorkspaceModel;
  recommendations: TieredRecommendations | null;
  isAnalyzing: boolean;
  isGeneratingRecommendations: boolean;
  onAction: (action: WorkspaceAction) => void;
}) {
  const summary =
    analysis?.portfolioSummary?.verdict ??
    analysis?.overallVerdict ??
    (workspace.recommendationsCount > 0 ? t('workspace.advisor.recommendationsReady') : null);
  const reasons = analysis?.portfolioSummary?.keyReasons ?? [];
  const risks = analysis?.portfolioSummary?.riskBoundaries ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {t('workspace.advisor.title')}
            </CardTitle>
            <CardDescription className="mt-1">{t('workspace.advisor.description')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <WorkspaceActionButton
              t={t}
              action={{ id: 'add-schools', intent: 'recommendations' }}
              onAction={onAction}
              isBusy={isGeneratingRecommendations}
              size="sm"
              variant="outline"
              labelKey="workspace.actions.add-candidates"
            />
            <WorkspaceActionButton
              t={t}
              action={{ id: 'generate-advice', intent: 'analysis' }}
              onAction={onAction}
              isBusy={isAnalyzing}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isAnalyzing ? (
          <div className="flex items-center gap-3 rounded-[var(--theme-radius-card)] border bg-muted/20 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('workspace.advisor.preparing')}</p>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            <p className="text-sm leading-6">{summary}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <AdvisorList
                title={t('workspace.advisor.listAdvice')}
                items={reasons}
                fallback={t('workspace.advisor.noAdviceYet')}
              />
              <AdvisorList
                title={t('workspace.advisor.risks')}
                items={risks}
                fallback={t('workspace.advisor.noRiskYet')}
              />
            </div>
            {recommendations && workspace.recommendationsCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('workspace.advisor.candidateCount', { count: workspace.recommendationsCount })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[var(--theme-radius-card)] border border-dashed p-5">
            <p className="text-sm font-semibold">{t('workspace.advisor.emptyTitle')}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('workspace.advisor.emptyDescription')}
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => onAction({ id: 'generate-advice', intent: 'analysis' })}
              disabled={isAnalyzing}
            >
              <ClipboardCheck className="h-4 w-4" />
              {t('workspace.actions.generate-advice')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdvisorList({
  title,
  items,
  fallback,
}: {
  title: string;
  items: string[];
  fallback: string;
}) {
  const visibleItems = items.slice(0, 3);
  return (
    <div className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-3">
      <p className="text-sm font-semibold">{title}</p>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
          {visibleItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{fallback}</p>
      )}
    </div>
  );
}

function StatusChip({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  status: 'good' | 'warning' | 'risk';
}) {
  return (
    <div className={cn('rounded-[var(--theme-radius-card)] border p-2.5', statusBg(status))}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', statusText(status))} />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function WorkspaceActionButton({
  t,
  action,
  onAction,
  isBusy,
  size = 'sm',
  variant = 'default',
  className,
  labelKey,
}: {
  t: TFunction;
  action: WorkspaceAction;
  onAction: (action: WorkspaceAction) => void;
  isBusy: boolean;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
  className?: string;
  labelKey?: string;
}) {
  const label = t(labelKey ?? `workspace.actions.${action.id}`);
  const content = (
    <>
      {isBusy && action.intent !== 'navigate' ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4" />
      )}
      {label}
    </>
  );

  if (action.intent === 'navigate' && action.href) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() => onAction(action)}
      disabled={isBusy && action.intent !== 'navigate'}
    >
      {content}
    </Button>
  );
}

function actionFromNextStep(step: SchoolApplicationRow['nextStep']): WorkspaceAction {
  switch (step) {
    case 'sync-requirements':
      return { id: 'sync-requirements', intent: 'sync' };
    case 'review-deadlines':
    case 'view-timeline':
      return { id: 'review-deadlines', href: '/timeline', intent: 'navigate' };
    case 'write-essays':
      return { id: 'sync-requirements', href: '/essays', intent: 'navigate' };
    case 'run-prediction':
      return { id: 'generate-advice', href: '/prediction', intent: 'navigate' };
    case 'complete-profile':
      return { id: 'complete-profile', href: '/profile', intent: 'navigate' };
    case 'add-schools':
    case 'add-safety':
    case 'generate-advice':
      return {
        id: step,
        href: step === 'generate-advice' ? undefined : '/schools',
        intent: step === 'generate-advice' ? 'analysis' : 'navigate',
      };
  }
}

function deadlineLabel(t: TFunction, row: SchoolApplicationRow) {
  if (!row.deadline || row.daysUntil === null) return t('workspace.schoolBoard.deadlineMissing');
  return `${formatDate(row.deadline)} · ${deadlineShortLabel(t, row)}`;
}

function deadlineShortLabel(t: TFunction, row: SchoolApplicationRow) {
  if (row.daysUntil === null) return t('workspace.schoolBoard.deadlineMissing');
  if (row.daysUntil < 0)
    return t('workspace.schoolBoard.overdue', { days: Math.abs(row.daysUntil) });
  if (row.daysUntil === 0) return t('workspace.schoolBoard.dueToday');
  if (row.daysUntil <= 7) return t('workspace.schoolBoard.dueSoon', { days: row.daysUntil });
  if (row.daysUntil <= 30) return t('workspace.schoolBoard.dueMonth', { days: row.daysUntil });
  return t('workspace.schoolBoard.dueLater', { days: row.daysUntil });
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(date)
  );
}

function healthDescription(t: TFunction, check: HealthCheck) {
  return t(`workspace.health.${check.id}.${check.status}`, check.meta);
}

function statusBorder(status: 'good' | 'warning' | 'risk') {
  if (status === 'good') return 'border-success/25';
  if (status === 'risk') return 'border-destructive/30';
  return 'border-warning/30';
}

function statusBg(status: 'good' | 'warning' | 'risk') {
  if (status === 'good') return 'border-success/25 bg-success/5';
  if (status === 'risk') return 'border-destructive/30 bg-destructive/5';
  return 'border-warning/30 bg-warning/5';
}

function statusText(status: 'good' | 'warning' | 'risk') {
  if (status === 'good') return 'text-success';
  if (status === 'risk') return 'text-destructive';
  return 'text-warning';
}

function badgeVariant(status: 'good' | 'warning' | 'risk'): 'success' | 'warning' | 'destructive' {
  if (status === 'good') return 'success';
  if (status === 'risk') return 'destructive';
  return 'warning';
}

function toTieredRecommendations(
  result?: RecommendationResult | null
): TieredRecommendations | null {
  if (!result?.recommendations?.length) return null;

  const recommendations: TieredRecommendations = {
    reach: [],
    target: [],
    safety: [],
  };

  result.recommendations.forEach((school) => {
    const normalizedTier = school.tier === 'match' ? 'target' : school.tier;
    const key =
      normalizedTier === 'reach' || normalizedTier === 'target' || normalizedTier === 'safety'
        ? normalizedTier
        : 'target';
    recommendations[key].push({
      name: school.schoolName,
      nameZh: school.schoolMeta?.nameZh,
      reason: school.reasons?.[0] ?? result.summary,
      description: school.concerns?.[0],
      tier: key,
    } satisfies SchoolRecommendation);
  });

  return recommendations.reach.length +
    recommendations.target.length +
    recommendations.safety.length >
    0
    ? recommendations
    : null;
}
