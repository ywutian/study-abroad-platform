'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
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
import { apiClient } from '@/lib/api';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { qk } from '@/lib/query';
import { AI_TIMEOUTS } from '@/lib/constants';
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
  type WorkspaceAction,
} from './_components/application-workspace-model';
import { WorkspaceActionButton } from './_components/workspace-shared';
import {
  ApplicationHealthPanel,
  ApplicationNextActionBar,
  ApplicationReadinessStrip,
  ApplicationSchoolBoard,
} from './_components/workspace-panels';
import { AdvisorAnalysisSection } from './_components/advisor-analysis-section';

export default function UncommonAppPage() {
  const t = useTranslations('uncommonApp');
  const queryClient = useQueryClient();
  const authReady = useAuthReady();

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(
    () => queryClient.getQueryData<AIAnalysis>(qk.profile.aiAnalysis) ?? null
  );
  const [generatedRecommendations, setGeneratedRecommendations] =
    useState<TieredRecommendations | null>(null);

  const { data: schoolList, isLoading: listLoading } = useQuery({
    queryKey: qk.schoolList.all,
    queryFn: () => apiClient.get<SchoolListItem[]>(schoolListRoutes.list()),
    enabled: authReady,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<Profile>(profileRoutes.me()),
    enabled: authReady,
  });

  const { data: timelines, isLoading: timelinesLoading } = useQuery({
    queryKey: ['timelines'],
    queryFn: () => apiClient.get<TimelineResponse[]>(API_ROUTES.TIMELINES),
    enabled: authReady,
  });

  const { data: recommendationPreflight } = useQuery<RecommendationPreflight>({
    queryKey: ['recommendation', 'preflight'],
    queryFn: () => apiClient.get(recommendationRoutes.preflight()),
    enabled: authReady,
  });

  const { data: recommendationHistory } = useQuery<RecommendationResult[]>({
    queryKey: ['recommendation', 'history'],
    queryFn: () => apiClient.get(recommendationRoutes.history()),
    enabled: authReady,
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
      queryClient.invalidateQueries({ queryKey: qk.schoolList.all });
      queryClient.invalidateQueries({ queryKey: qk.profile.aiAnalysis });
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
      queryClient.setQueryData(qk.profile.aiAnalysis, response);
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
      queryClient.invalidateQueries({ queryKey: qk.schoolList.all });
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

  const handleGenerateRecommendations = () => {
    if (recommendationPreflight && !recommendationPreflight.canGenerate) {
      toast.error(t('recommendationsBlocked'));
      return;
    }
    recommendationsMutation.mutate();
  };

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

        {/* Screen-reader announcement for the async analysis lifecycle. */}
        <div className="sr-only" role="status" aria-live="polite">
          {isAnalyzing ? t('workspace.advisor.preparing') : analysis ? t('analysisComplete') : ''}
        </div>

        <div className="space-y-5">
          <ApplicationNextActionBar
            t={t}
            workspace={workspace}
            isLoading={isLoading}
            isBusy={isAnalyzing || isSyncing || isGeneratingRecommendations}
            onAction={handleAction}
          />

          <ApplicationReadinessStrip t={t} signals={workspace.readiness} isLoading={isLoading} />

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <ApplicationSchoolBoard
                t={t}
                workspace={workspace}
                isLoading={isLoading}
                isSyncing={isSyncing}
                onAction={handleAction}
                onDelete={(id) => deleteMutation.mutate(id)}
              />

              <AdvisorAnalysisSection
                t={t}
                analysis={analysis}
                workspace={workspace}
                isAnalyzing={isAnalyzing}
                isGeneratingRecommendations={isGeneratingRecommendations}
                onAction={handleAction}
                onRefresh={() => profileAnalysisMutation.mutate()}
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
