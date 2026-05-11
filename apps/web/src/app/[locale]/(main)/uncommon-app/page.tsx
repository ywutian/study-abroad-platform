'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  RefreshCw,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import {
  profileRoutes,
  recommendationRoutes,
  schoolListRoutes,
  type RecommendationPreflight,
  type RecommendationResult,
} from '@study-abroad/shared';
import { PageContainer } from '@/components/layout';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';

import type {
  SchoolListItem,
  Profile,
  AIAnalysis,
  TieredRecommendations,
} from './_components/types';
import { StepProfileGrading } from './_components/step-profile-grading';
import { StepSchoolLists } from './_components/step-school-lists';
import { StepAIRecommendations } from './_components/step-ai-recommendations';
import { StepResults } from './_components/step-results';

const PROFILE_ANALYSIS_KEY = ['profile-ai-analysis'] as const;

export default function UncommonAppPage() {
  const t = useTranslations('uncommonApp');
  const locale = useLocale();
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

  const { data: recommendationPreflight } = useQuery<RecommendationPreflight>({
    queryKey: ['recommendation', 'preflight'],
    queryFn: () => apiClient.get(recommendationRoutes.preflight()),
  });

  const { data: recommendationHistory } = useQuery<RecommendationResult[]>({
    queryKey: ['recommendation', 'history'],
    queryFn: () => apiClient.get(recommendationRoutes.history()),
  });

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

  const aiRecommendationsMutation = useMutation({
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
      toast.success(t('aiRecommendationsLoaded'));
    },
    onError: () => {
      toast.error(t('aiRecommendationsError'));
    },
  });

  const handleGradeProfile = () => profileAnalysisMutation.mutate();
  const isAnalyzing = profileAnalysisMutation.isPending;

  const handleGetAIRecommendations = () => {
    if (recommendationPreflight && !recommendationPreflight.canGenerate) {
      toast.error(t('recommendationsBlocked'));
      return;
    }
    aiRecommendationsMutation.mutate();
  };

  const groupedSchools = useMemo(
    () => ({
      REACH: schoolList?.filter((s) => s.tier === 'REACH') || [],
      TARGET: schoolList?.filter((s) => s.tier === 'TARGET') || [],
      SAFETY: schoolList?.filter((s) => s.tier === 'SAFETY') || [],
    }),
    [schoolList]
  );

  const profileScore = useMemo(
    () =>
      profile
        ? (profile.gpa ? 20 : 0) +
          (profile.testScores?.length ? 30 : 0) +
          (profile.activities?.length ? 25 : 0) +
          (profile.awards?.length ? 25 : 0)
        : 0,
    [profile]
  );

  const latestRecommendations =
    generatedRecommendations ?? toTieredRecommendations(recommendationHistory?.[0]);
  const essayPromptCount =
    schoolList?.reduce((sum, item) => sum + (item.essayPromptCount ?? 0), 0) ?? 0;
  const targetSchoolCount = schoolList?.length ?? 0;
  const completedTasks = buildTasks({
    t,
    profileScore,
    targetSchoolCount,
    essayPromptCount,
    hasAnalysis: Boolean(analysis),
    hasRecommendations: Boolean(latestRecommendations),
  }).filter((task) => task.done).length;

  return (
    <AIErrorBoundary feature="uncommon-app">
      <PageContainer maxWidth="7xl">
        <PageHeader
          title={t('title')}
          description={t('description')}
          icon={GraduationCap}
          color="blue"
          stats={[
            {
              label: t('dashboard.stats.schools'),
              value: targetSchoolCount,
              icon: GraduationCap,
            },
            {
              label: t('dashboard.stats.essays'),
              value: essayPromptCount,
              icon: FileText,
            },
            {
              label: t('dashboard.stats.tasks'),
              value: `${completedTasks}/5`,
              icon: CheckCircle2,
            },
            {
              label: t('dashboard.stats.strategy'),
              value: analysis
                ? t(`strategyStatus.${analysis.status ?? 'fresh'}`)
                : t('strategyStatus.manual'),
              icon: Sparkles,
            },
          ]}
          actions={
            <Button onClick={handleGradeProfile} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="mr-2 h-4 w-4" />
              )}
              {isAnalyzing ? t('analyzing') : t('generateAnalysis')}
            </Button>
          }
        />

        <div className="space-y-6">
          <ApplicationCommandCenter
            t={t}
            profileScore={profileScore}
            profileLoading={profileLoading}
            schoolList={schoolList}
            listLoading={listLoading}
            essayPromptCount={essayPromptCount}
            analysis={analysis}
            recommendations={latestRecommendations}
            onGenerateAnalysis={handleGradeProfile}
            isAnalyzing={isAnalyzing}
            onGenerateRecommendations={handleGetAIRecommendations}
            isGeneratingRecommendations={aiRecommendationsMutation.isPending}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="space-y-6">
              <StepSchoolLists
                t={t}
                locale={locale}
                schoolList={schoolList}
                listLoading={listLoading}
                groupedSchools={groupedSchools}
                onDelete={(id) => deleteMutation.mutate(id)}
              />

              <StepAIRecommendations
                t={t}
                locale={locale}
                aiLoading={aiRecommendationsMutation.isPending}
                aiRecommendations={latestRecommendations}
                onGetRecommendations={handleGetAIRecommendations}
              />
            </div>

            <div className="space-y-6">
              <StepProfileGrading
                t={t}
                profile={profile}
                profileLoading={profileLoading}
                profileScore={profileScore}
                isAnalyzing={isAnalyzing}
                onGradeProfile={handleGradeProfile}
              />

              {(analysis || isAnalyzing) && (
                <StepResults
                  t={t}
                  analysis={analysis}
                  isAnalyzing={isAnalyzing}
                  onReAnalyze={handleGradeProfile}
                  onDone={() => setAnalysis(null)}
                />
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </AIErrorBoundary>
  );
}

function ApplicationCommandCenter({
  t,
  profileScore,
  profileLoading,
  schoolList,
  listLoading,
  essayPromptCount,
  analysis,
  recommendations,
  onGenerateAnalysis,
  isAnalyzing,
  onGenerateRecommendations,
  isGeneratingRecommendations,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  profileScore: number;
  profileLoading: boolean;
  schoolList: SchoolListItem[] | undefined;
  listLoading: boolean;
  essayPromptCount: number;
  analysis: AIAnalysis | null;
  recommendations: TieredRecommendations | null;
  onGenerateAnalysis: () => void;
  isAnalyzing: boolean;
  onGenerateRecommendations: () => void;
  isGeneratingRecommendations: boolean;
}) {
  const schoolCount = schoolList?.length ?? 0;
  const reachCount = schoolList?.filter((item) => item.tier === 'REACH').length ?? 0;
  const targetCount = schoolList?.filter((item) => item.tier === 'TARGET').length ?? 0;
  const safetyCount = schoolList?.filter((item) => item.tier === 'SAFETY').length ?? 0;
  const tasks = buildTasks({
    t,
    profileScore,
    targetSchoolCount: schoolCount,
    essayPromptCount,
    hasAnalysis: Boolean(analysis),
    hasRecommendations: Boolean(recommendations),
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {t('dashboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <OverviewMetric
              label={t('dashboard.profile')}
              value={profileLoading ? null : `${profileScore}%`}
              icon={Target}
            />
            <OverviewMetric
              label={t('dashboard.schoolBalance')}
              value={listLoading ? null : `${reachCount}/${targetCount}/${safetyCount}`}
              icon={GraduationCap}
            />
            <OverviewMetric
              label={t('dashboard.essayPrompts')}
              value={listLoading ? null : String(essayPromptCount)}
              icon={FileText}
            />
            <OverviewMetric
              label={t('dashboard.recommendations')}
              value={recommendations ? String(countRecommendations(recommendations)) : '0'}
              icon={Sparkles}
            />
          </div>

          <div className="rounded-[var(--theme-radius-card)] border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">{t('dashboard.strategyTitle')}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {analysis?.overallVerdict ??
                    analysis?.portfolioSummary?.verdict ??
                    t('dashboard.strategyEmpty')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={onGenerateRecommendations}
                  disabled={isGeneratingRecommendations}
                >
                  {isGeneratingRecommendations ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {t('getRecommendations')}
                </Button>
                <Button onClick={onGenerateAnalysis} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <WandSparkles className="mr-2 h-4 w-4" />
                  )}
                  {t('generateAnalysis')}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-primary" />
            {t('tasks.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.map((task) => (
              <Link
                key={`${task.href}-${task.title}`}
                href={task.href}
                className="flex items-start gap-3 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-3 transition hover:border-primary/40"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    task.done
                      ? 'border-success bg-success/10 text-success'
                      : 'border-warning bg-warning/10 text-warning'
                  )}
                >
                  {task.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{task.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {task.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon: typeof GraduationCap;
}) {
  return (
    <div className="rounded-[var(--theme-radius-card)] border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {value === null ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className="text-2xl font-semibold">{value}</p>
      )}
    </div>
  );
}

function buildTasks({
  t,
  profileScore,
  targetSchoolCount,
  essayPromptCount,
  hasAnalysis,
  hasRecommendations,
}: {
  t: (key: string, values?: Record<string, string | number>) => string;
  profileScore: number;
  targetSchoolCount: number;
  essayPromptCount: number;
  hasAnalysis: boolean;
  hasRecommendations: boolean;
}) {
  return [
    {
      done: profileScore >= 80,
      title: t('tasks.profile.title'),
      description: t('tasks.profile.description', { score: profileScore }),
      href: '/profile',
    },
    {
      done: targetSchoolCount >= 6,
      title: t('tasks.schools.title'),
      description: t('tasks.schools.description', { count: targetSchoolCount }),
      href: '/schools',
    },
    {
      done: essayPromptCount > 0,
      title: t('tasks.essays.title'),
      description: t('tasks.essays.description', { count: essayPromptCount }),
      href: '/essays',
    },
    {
      done: hasRecommendations,
      title: t('tasks.recommendations.title'),
      description: t('tasks.recommendations.description'),
      href: '/schools',
    },
    {
      done: hasAnalysis,
      title: t('tasks.strategy.title'),
      description: t('tasks.strategy.description'),
      href: '/uncommon-app',
    },
  ];
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
    const key = school.tier === 'match' ? 'target' : school.tier;
    recommendations[key].push({
      name: school.schoolName,
      nameZh: school.schoolMeta?.nameZh,
      reason: school.reasons?.[0] ?? result.summary,
      description: school.concerns?.[0],
      tier: key,
    });
  });

  return countRecommendations(recommendations) > 0 ? recommendations : null;
}

function countRecommendations(recommendations: TieredRecommendations) {
  return (
    recommendations.reach.length + recommendations.target.length + recommendations.safety.length
  );
}
