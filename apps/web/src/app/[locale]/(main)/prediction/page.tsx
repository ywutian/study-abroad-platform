/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
  LayoutDashboard,
  Lightbulb,
} from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PredictionHistoryTab } from './_components/PredictionHistoryTab';
import { PageContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuth } from '@/hooks/use-auth';
import { schoolListRoutes, schoolRoutes, profileRoutes } from '@study-abroad/shared';
import type { ProfileReadinessV1 } from '@study-abroad/shared';
import { detectInternationalStatus } from '@study-abroad/shared/scoring';
import { usePredictionDashboard, useRunPrediction } from '@/hooks/use-prediction';
import {
  PredictionHeader,
  ProfileSnapshotBar,
  SchoolSelectorCard,
  PortfolioDiagnosisCard,
  PredictionPortfolioSummaryStream,
  PredictionResultList,
  RecommendedSchoolsBlock,
  PredictionEvidencePanel,
} from '@/components/features/prediction';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';
import { Button } from '@/components/ui/button';
import type {
  PredictionResult,
  PredictionResponse,
  SchoolSearchItem,
  TierType,
} from '@/components/features/prediction';

interface SchoolListItemApi {
  id: string;
  schoolId: string;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
  };
}

export default function PredictionPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isInitialized, isAuthenticated } = useAuth();
  const hasAutoRun = useRef(false);
  const canFetchProtectedData = isInitialized && isAuthenticated;
  const callbackPath = useMemo(() => {
    const query = searchParams.toString();
    return `/prediction${query ? `?${query}` : ''}`;
  }, [searchParams]);

  useEffect(() => {
    if (!isInitialized || isAuthenticated) return;
    router.replace(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }, [callbackPath, isAuthenticated, isInitialized, router]);

  // School selection (pre-filled from user school list)
  const [activeTab, setActiveTab] = useState<'workspace' | 'history' | 'evidence'>('workspace');
  const [selectedSchools, setSelectedSchools] = useState<SchoolSearchItem[]>([]);
  const [hasPreFilled, setHasPreFilled] = useState(false);
  const { data: schoolListData } = useQuery({
    queryKey: qk.schoolList.all,
    queryFn: () => apiClient.get<SchoolListItemApi[]>(schoolListRoutes.list()),
    enabled: canFetchProtectedData,
  });
  useEffect(() => {
    if (hasPreFilled || !schoolListData?.length) return;
    const items: SchoolSearchItem[] = schoolListData
      .filter((item) => item.school)
      .map((item) => ({
        id: item.school.id,
        name: item.school.name,
        nameZh: item.school.nameZh,
        usNewsRank: item.school.usNewsRank,
        acceptanceRate:
          item.school.acceptanceRate != null ? Number(item.school.acceptanceRate) : undefined,
      }));
    setSelectedSchools(items);
    setHasPreFilled(true);
  }, [schoolListData, hasPreFilled]);

  // Prediction results
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [responseMetadata, setResponseMetadata] = useState<{
    dataCompleteness?: number;
    memoryContext?: PredictionResponse['memoryContext'];
    processingTime?: number;
  }>({});

  // UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshingSchoolId, setRefreshingSchoolId] = useState<string | null>(null);
  const [ucExpandedFrom, setUcExpandedFrom] = useState<SchoolSearchItem[] | null>(null);

  // Data fetching
  const { data: dashboardData } = usePredictionDashboard(canFetchProtectedData);
  const predictMutation = useRunPrediction();
  const { data: ucIdsData, isLoading: ucIdsLoading } = useQuery({
    queryKey: qk.schools.ucIds(),
    queryFn: () => apiClient.get<{ schoolIds: string[] }>(schoolRoutes.ucIds()),
    enabled: canFetchProtectedData,
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<any>(profileRoutes.me()),
    enabled: canFetchProtectedData,
  });
  const { data: readiness } = useQuery({
    queryKey: ['profile', 'readiness'],
    queryFn: () => apiClient.get<ProfileReadinessV1>(profileRoutes.readiness()),
    enabled: canFetchProtectedData,
  });

  const isInternational = useMemo(() => {
    if (!profileData) return false;
    return detectInternationalStatus({
      nationality: profileData.nationality,
      countryOfResidence: profileData.countryOfResidence,
      citizenship: profileData.citizenship,
      educationSystem: profileData.educationSystem,
      currentSchoolType: profileData.currentSchoolType,
    }).isInternational;
  }, [profileData]);

  const profileChecklist = useMemo(() => {
    if (!profileData) return [];
    return [
      { key: 'gpa', complete: Boolean(profileData.gpa) },
      {
        key: 'testScores',
        complete:
          Boolean(profileData.testScores?.length) || Boolean(profileData.applyingTestOptional),
      },
      { key: 'activities', complete: Boolean(profileData.activities?.length) },
      { key: 'awards', complete: Boolean(profileData.awards?.length) },
      { key: 'major', complete: Boolean(profileData.targetMajor || profileData.intendedMajor) },
    ];
  }, [profileData]);
  const hasProfileGaps = profileChecklist.some((item) => !item.complete);
  const firstMissingProfileItem = profileChecklist.find((item) => !item.complete);
  const profileCompleteness =
    responseMetadata.dataCompleteness ??
    readiness?.profileCompleteness?.score ??
    (profileChecklist.length > 0
      ? Math.round(
          (profileChecklist.filter((item) => item.complete).length / profileChecklist.length) * 100
        )
      : undefined);
  // Prediction eligibility — authoritative from `/profiles/me/readiness`.
  // While `readiness` is still loading it is undefined → treated as allowed;
  // the 412 backstop covers that brief window.
  const profileBlocksPrediction = readiness?.overall?.canRunPrediction === false;
  const predictionBlockers = readiness?.overall?.predictionBlockers ?? [];
  const selectedIds = useMemo(
    () => new Set(selectedSchools.map((school) => school.id)),
    [selectedSchools]
  );
  const dashboardPredictions = useMemo(
    () => dashboardData?.predictions ?? [],
    [dashboardData?.predictions]
  );
  const activeSnapshotPredictions = results.length > 0 ? results : dashboardPredictions;
  const formalPredictedCount =
    results.length > 0
      ? results.length
      : dashboardPredictions.filter((prediction) => selectedIds.has(prediction.schoolId)).length;
  const predictionTierBySchoolId = useMemo(() => {
    const tierBySchoolId: Partial<Record<string, TierType>> = {};
    for (const prediction of activeSnapshotPredictions) {
      if (
        prediction.tier === 'reach' ||
        prediction.tier === 'match' ||
        prediction.tier === 'safety' ||
        prediction.tier === 'unavailable'
      ) {
        tierBySchoolId[prediction.schoolId] = prediction.tier;
      }
    }
    return tierBySchoolId;
  }, [activeSnapshotPredictions]);

  // Handlers
  const handleAddSchool = useCallback((school: SchoolSearchItem) => {
    setSelectedSchools((prev) => {
      if (prev.find((s) => s.id === school.id)) return prev;
      return [...prev, school];
    });
  }, []);

  const handleRemoveSchool = useCallback((schoolId: string) => {
    setSelectedSchools((prev) => prev.filter((s) => s.id !== schoolId));
  }, []);

  const handlePredict = useCallback(() => {
    if (!canFetchProtectedData) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return;
    }
    if (selectedSchools.length === 0) {
      toast.error(t('prediction.selectSchoolsFirst'));
      return;
    }
    if (profileBlocksPrediction) {
      toast.error(t('prediction.profileInsufficientHint'));
      return;
    }
    const selectedIds = selectedSchools.map((s) => s.id);
    const ucIds = ucIdsData?.schoolIds ?? [];
    const hasAnyUc = ucIds.length > 0 && selectedIds.some((id) => ucIds.includes(id));
    // Keep the user's non-UC picks alongside the UC comparison set — the backend
    // expands UC to the campuses they own and preserves the rest. (This used to
    // REPLACE the selection with all 9 UC ids, silently dropping non-UC schools
    // like MIT, and 400'd when the user hadn't saved all 9 UCs.)
    const schoolIdsToUse = hasAnyUc ? Array.from(new Set([...selectedIds, ...ucIds])) : selectedIds;
    if (hasAnyUc) {
      setUcExpandedFrom([...selectedSchools]);
    } else {
      setUcExpandedFrom(null);
    }
    predictMutation.mutate(
      { schoolIds: schoolIdsToUse, forceRefresh: true },
      {
        onSuccess: (data) => {
          const predictionResults = data.results || [];
          setResults(predictionResults);
          setResponseMetadata({
            dataCompleteness: data.dataCompleteness,
            memoryContext: data.memoryContext,
            processingTime: data.processingTime,
          });
          const expandedByBackend = data.ucComparisonExpanded;
          if ((hasAnyUc || expandedByBackend) && predictionResults.length > 0) {
            setSelectedSchools(
              predictionResults.map((r) => ({
                id: r.schoolId,
                name: r.schoolName ?? '',
                nameZh: (r as { schoolNameZh?: string }).schoolNameZh,
                usNewsRank: r.schoolMeta?.usNewsRank,
                acceptanceRate:
                  r.schoolMeta?.acceptanceRate != null
                    ? Number(r.schoolMeta.acceptanceRate)
                    : undefined,
              }))
            );
            if (expandedByBackend && !hasAnyUc) {
              setUcExpandedFrom([...selectedSchools]);
            }
          }
          if (predictionResults.length > 0) {
            toast.success(t('prediction.successMessage', { count: predictionResults.length }));
          } else {
            toast.info(t('prediction.noResult'));
          }
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- predictMutation.mutate is stable, adding predictMutation object would cause infinite re-renders
  }, [
    callbackPath,
    canFetchProtectedData,
    profileBlocksPrediction,
    router,
    selectedSchools,
    ucIdsData?.schoolIds,
    predictMutation.mutate,
    t,
  ]);

  const handleToggleExpand = useCallback((schoolId: string) => {
    setExpandedId((prev) => (prev === schoolId ? null : schoolId));
  }, []);

  // Update local result with reported actual result
  const handleResultReported = useCallback((schoolId: string, reportedResult: string) => {
    setResults((prev) =>
      prev.map((r) => (r.schoolId === schoolId ? { ...r, actualResult: reportedResult } : r))
    );
  }, []);

  // Refresh a single school prediction
  const handleRefreshSchool = useCallback(
    (schoolId: string) => {
      setRefreshingSchoolId(schoolId);
      predictMutation.mutate(
        { schoolIds: [schoolId], forceRefresh: true },
        {
          onSuccess: (data) => {
            if (data.results?.[0]) {
              setResults((prev) =>
                prev.map((r) => (r.schoolId === schoolId ? data.results[0] : r))
              );
            }
            setRefreshingSchoolId(null);
          },
          onError: () => setRefreshingSchoolId(null),
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- predictMutation.mutate is stable
    [predictMutation.mutate]
  );

  const handleUcPredict = useCallback(() => {
    const ucIds = ucIdsData?.schoolIds;
    if (!ucIds?.length) {
      toast.error(t('prediction.ucOneClickUnavailable'));
      return;
    }
    predictMutation.mutate(
      { schoolIds: ucIds, forceRefresh: true },
      {
        onSuccess: (data) => {
          const predictionResults = data.results || [];
          setResults(predictionResults);
          setResponseMetadata({
            dataCompleteness: data.dataCompleteness,
            memoryContext: data.memoryContext,
            processingTime: data.processingTime,
          });
          setSelectedSchools(
            predictionResults.map((r) => ({
              id: r.schoolId,
              name: r.schoolName ?? '',
              nameZh: (r as { schoolNameZh?: string }).schoolNameZh,
            }))
          );
          if (predictionResults.length > 0) {
            toast.success(t('prediction.successMessage', { count: predictionResults.length }));
          } else {
            toast.info(t('prediction.noResult'));
          }
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- predictMutation.mutate is stable
  }, [ucIdsData?.schoolIds, predictMutation.mutate, t]);

  const handleCollapseUc = useCallback(() => {
    if (!ucExpandedFrom) return;
    setSelectedSchools(ucExpandedFrom);
    setResults((prev) => {
      const originalIds = new Set(ucExpandedFrom.map((s) => s.id));
      return prev.filter((r) => originalIds.has(r.schoolId));
    });
    setUcExpandedFrom(null);
  }, [ucExpandedFrom]);

  useEffect(() => {
    if (hasAutoRun.current) return;
    if (!canFetchProtectedData) return;
    if (searchParams.get('autorun') !== '1') return;
    if (!hasPreFilled || selectedSchools.length === 0 || predictMutation.isPending || ucIdsLoading)
      return;
    // Don't auto-run a prediction the profile is not yet eligible for.
    if (profileBlocksPrediction) return;
    hasAutoRun.current = true;
    handlePredict();
  }, [
    handlePredict,
    canFetchProtectedData,
    hasPreFilled,
    predictMutation.isPending,
    profileBlocksPrediction,
    searchParams,
    selectedSchools.length,
    ucIdsLoading,
  ]);

  if (!canFetchProtectedData) {
    return (
      <AIErrorBoundary feature="prediction">
        <PageContainer maxWidth="default">
          <PredictionHeader />
          <div className="rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)] px-4 py-10 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        </PageContainer>
      </AIErrorBoundary>
    );
  }

  return (
    <AIErrorBoundary feature="prediction">
      <PageContainer maxWidth="default">
        <PredictionHeader dataCompleteness={responseMetadata.dataCompleteness} />
        <ProfileSnapshotBar
          profile={profileData}
          completeness={profileCompleteness}
          hasProfileGaps={hasProfileGaps}
          firstMissingLabel={
            firstMissingProfileItem
              ? t(`prediction.dataChecklist.${firstMissingProfileItem.key}`)
              : undefined
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'workspace' | 'history' | 'evidence')}
          className="mb-4"
        >
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            <TabsTrigger value="workspace" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t('prediction.tabs.workspace')}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              {t('prediction.tabs.history')}
            </TabsTrigger>
            <TabsTrigger value="evidence" className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              {t('prediction.tabs.evidence')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'history' ? (
          <PredictionHistoryTab
            onRefreshSchool={handleRefreshSchool}
            refreshingSchoolId={refreshingSchoolId}
          />
        ) : activeTab === 'evidence' ? (
          <PredictionEvidencePanel />
        ) : (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="xl:sticky xl:top-24 xl:self-start">
              <SchoolSelectorCard
                selectedSchools={selectedSchools}
                onAdd={handleAddSchool}
                onRemove={handleRemoveSchool}
                onPredict={handlePredict}
                isPredicting={predictMutation.isPending}
                profileBlocked={profileBlocksPrediction}
                predictionTiers={predictionTierBySchoolId}
                hasPredictions={formalPredictedCount > 0}
                compact
                className="mb-0"
              />
            </div>

            <div className="min-w-0 space-y-4">
              {/* Data completeness checklist for sparse profiles.
                  When the profile is below the prediction-eligibility bar the
                  card switches to a "blocked" variant that lists the exact
                  blockers (GPA / basic info / target schools) instead of the
                  softer "run now, refine later" copy. */}
              {profileData && (hasProfileGaps || profileBlocksPrediction) && (
                <div className="rounded-[var(--theme-radius-card)] border border-warning/25 bg-warning/10 p-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {profileBlocksPrediction
                          ? t('prediction.dataChecklistBlockedTitle')
                          : t('prediction.dataChecklistTitle')}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profileBlocksPrediction
                          ? t('prediction.dataChecklistBlockedDesc')
                          : t('prediction.dataChecklistDesc')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {profileBlocksPrediction
                          ? predictionBlockers.map((blocker) => (
                              <div
                                key={blocker}
                                className="flex items-center gap-2 rounded-[var(--theme-radius-button)] border border-warning/35 bg-[color:var(--theme-control-bg)] px-2.5 py-1.5 text-xs"
                              >
                                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                <span>{t(`prediction.predictionBlocker.${blocker}`)}</span>
                              </div>
                            ))
                          : profileChecklist
                              .filter((item) => !item.complete)
                              .map((item) => (
                                <div
                                  key={item.key}
                                  className="flex items-center gap-2 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-2.5 py-1.5 text-xs"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{t(`prediction.dataChecklist.${item.key}`)}</span>
                                </div>
                              ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="shrink-0 border-warning/35 text-warning"
                    >
                      <Link href="/profile">{t('prediction.completeProfile')}</Link>
                    </Button>
                  </div>
                </div>
              )}

              {(activeSnapshotPredictions.length > 0 || selectedSchools.length > 0) && (
                <PortfolioDiagnosisCard
                  predictions={activeSnapshotPredictions}
                  selectedCount={selectedSchools.length}
                />
              )}

              {results.length > 0 && <PredictionPortfolioSummaryStream results={results} />}

              {Boolean(ucIdsData?.schoolIds?.length) && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUcPredict}
                    disabled={predictMutation.isPending}
                  >
                    {predictMutation.isPending
                      ? t('prediction.loading.analyzing')
                      : t('prediction.ucOneClick')}
                  </Button>
                </div>
              )}

              {results.length > 0 ? (
                <>
                  {ucExpandedFrom && (
                    <div className="mb-4 flex items-start gap-3 rounded-[var(--theme-radius-card)] border border-primary/20 bg-[color:var(--theme-control-selected-bg)] p-3">
                      <Info className="h-4 w-4 mt-1 text-primary shrink-0" />
                      <div className="flex-1 text-sm">
                        <p className="text-foreground">{t('prediction.ucExpandedDesc')}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCollapseUc}
                        className="shrink-0 border-primary/35 text-primary"
                      >
                        {t('prediction.ucCollapseToOriginal')}
                      </Button>
                    </div>
                  )}
                  <PredictionResultList
                    results={results}
                    expandedId={expandedId}
                    onToggleExpand={handleToggleExpand}
                    onResultReported={handleResultReported}
                    onRefresh={handleRefreshSchool}
                    refreshingSchoolId={refreshingSchoolId}
                    isInternational={isInternational}
                    dataCompleteness={responseMetadata.dataCompleteness}
                  />
                  <AIErrorBoundary feature="recommendation">
                    <RecommendedSchoolsBlock />
                  </AIErrorBoundary>
                </>
              ) : (
                !predictMutation.isPending &&
                selectedSchools.length === 0 && (
                  <EmptyState
                    type="first-time"
                    title={t('prediction.startPrediction')}
                    description={t('prediction.emptyHint')}
                  />
                )
              )}
            </div>
          </div>
        )}
      </PageContainer>
    </AIErrorBoundary>
  );
}
