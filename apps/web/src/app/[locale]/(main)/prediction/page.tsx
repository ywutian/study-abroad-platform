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
import {
  schoolListRoutes,
  schoolRoutes,
  profileRoutes,
  MAX_SCHOOLS_PER_BATCH,
} from '@study-abroad/shared';
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
  PredictionDetailPane,
  RecommendedSchoolsBlock,
  PredictionEvidencePanel,
} from '@/components/features/prediction';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/use-media-query';
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

// Same order the list renders rows (reach → match → safety → unavailable, then
// probability desc) so "the top result" the detail pane auto-selects matches the
// first visible row.
const TIER_RANK: Record<string, number> = { reach: 0, match: 1, safety: 2, unavailable: 3 };

// The page scrolls with the normal browser scrollbar (COL2 drives its height).
// COL1 (selector) and COL3 (detail) are sticky side panels — they ride along
// instead of getting their own scroll boxes. A panel only grows an (unobtrusive,
// thin) internal scrollbar in the rare case its content exceeds the viewport,
// e.g. one very tall school detail. This is what replaced the viewport-locked
// "three internal scrollbars" workbench feel. Scrollbar utility classes are
// applied unprefixed (inert without overflow) since they're custom, not Tailwind.
const STICKY_PANEL =
  'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent ' +
  'lg:sticky lg:self-start lg:top-[var(--app-header-h,6.5rem)] ' +
  'lg:max-h-[calc(100dvh-var(--app-header-h,6.5rem))] lg:overflow-y-auto';

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshingSchoolId, setRefreshingSchoolId] = useState<string | null>(null);
  const [ucExpandedFrom, setUcExpandedFrom] = useState<SchoolSearchItem[] | null>(null);
  const isDesktop = useIsDesktop();

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
    // Backend caps a single prediction request at MAX_SCHOOLS_PER_BATCH (shared
    // SSOT, enforced by PredictionRequestDto). Surface a toast instead of letting
    // the request 400 silently — the count includes UC cross-campus expansion.
    if (schoolIdsToUse.length > MAX_SCHOOLS_PER_BATCH) {
      toast.error(t('prediction.tooManySchools', { max: MAX_SCHOOLS_PER_BATCH }));
      return;
    }
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

  const handleSelectSchool = useCallback((schoolId: string) => {
    setSelectedId(schoolId);
  }, []);

  // The row that should be selected by default (top of the list).
  const topResult = useMemo(() => {
    if (results.length === 0) return null;
    return [...results].sort((a, b) => {
      const ta = TIER_RANK[a.tier] ?? 3;
      const tb = TIER_RANK[b.tier] ?? 3;
      if (ta !== tb) return ta - tb;
      return (b.probability ?? -1) - (a.probability ?? -1);
    })[0];
  }, [results]);

  const selectedResult = useMemo(
    () => results.find((r) => r.schoolId === selectedId) ?? null,
    [results, selectedId]
  );

  // Keep selection valid. On desktop the detail pane is always visible, so
  // auto-select the top row when nothing valid is selected. On mobile the detail
  // is a tap-to-open drawer, so we only CLEAR a stale selection — never auto-open.
  useEffect(() => {
    const stillValid = selectedId != null && results.some((r) => r.schoolId === selectedId);
    if (stillValid) return;
    if (isDesktop && results.length > 0) {
      setSelectedId(topResult?.schoolId ?? null);
    } else if (selectedId != null) {
      setSelectedId(null);
    }
  }, [results, selectedId, isDesktop, topResult]);

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
      <PageContainer variant="workbench" className="lg:h-auto lg:overflow-visible">
        <div className="shrink-0">
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
        </div>

        {activeTab === 'history' ? (
          <div className="min-w-0">
            <PredictionHistoryTab
              onRefreshSchool={handleRefreshSchool}
              refreshingSchoolId={refreshingSchoolId}
            />
          </div>
        ) : activeTab === 'evidence' ? (
          <div className="min-w-0">
            <PredictionEvidencePanel />
          </div>
        ) : (
          <>
            <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(360px,460px)]">
              {/* COL 1 — school selector (sticky side panel) */}
              <div className={`min-w-0 ${STICKY_PANEL} lg:pr-1`}>
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

              {/* COL 2 — scan surface (natural flow — drives the page height) */}
              <div className="min-w-0">
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

                  {predictMutation.isPending && results.length === 0 ? (
                    <div className="rounded-[var(--theme-radius-card)] border bg-card p-8 text-center text-sm text-muted-foreground">
                      {t('prediction.loading.analyzing')}
                    </div>
                  ) : results.length > 0 ? (
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
                        selectedId={selectedId}
                        onSelect={handleSelectSchool}
                      />
                      <AIErrorBoundary feature="recommendation">
                        <RecommendedSchoolsBlock />
                      </AIErrorBoundary>
                    </>
                  ) : (
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

              {/* COL 3 — detail / analysis surface (desktop, sticky side panel) */}
              <div className={`hidden min-w-0 lg:block ${STICKY_PANEL} lg:pl-1`}>
                {isDesktop && selectedResult ? (
                  <PredictionDetailPane
                    result={selectedResult}
                    onResultReported={handleResultReported}
                    onRefresh={handleRefreshSchool}
                    isRefreshing={refreshingSchoolId === selectedResult.schoolId}
                    isInternational={isInternational}
                    dataCompleteness={responseMetadata.dataCompleteness}
                  />
                ) : (
                  <DetailEmptyPrompt hasResults={results.length > 0} />
                )}
              </div>
            </div>

            {/* Mobile / tablet — detail opens in a bottom drawer */}
            {!isDesktop && (
              <Sheet
                open={selectedId != null}
                onOpenChange={(open) => {
                  if (!open) setSelectedId(null);
                }}
              >
                <SheetContent side="bottom" className="h-[90dvh] overflow-y-auto rounded-t-xl p-4">
                  <SheetHeader className="px-0 pt-0 text-left">
                    <SheetTitle className="min-w-0 truncate">
                      {selectedResult?.schoolName ?? t('prediction.detailPaneTitle')}
                    </SheetTitle>
                  </SheetHeader>
                  {selectedResult && (
                    <PredictionDetailPane
                      result={selectedResult}
                      onResultReported={handleResultReported}
                      onRefresh={handleRefreshSchool}
                      isRefreshing={refreshingSchoolId === selectedResult.schoolId}
                      isInternational={isInternational}
                      dataCompleteness={responseMetadata.dataCompleteness}
                    />
                  )}
                </SheetContent>
              </Sheet>
            )}
          </>
        )}
      </PageContainer>
    </AIErrorBoundary>
  );
}

/** Placeholder shown in the desktop detail column when no school is selected. */
function DetailEmptyPrompt({ hasResults }: { hasResults: boolean }) {
  const t = useTranslations();
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[var(--theme-radius-card)] border border-dashed bg-muted/20 p-8 text-center">
      <LayoutDashboard className="mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{t('prediction.detailEmptyTitle')}</p>
      <p className="mt-1 max-w-[26ch] text-xs text-muted-foreground">
        {hasResults ? t('prediction.detailEmptyDesc') : t('prediction.detailEmptyNoResults')}
      </p>
    </div>
  );
}
