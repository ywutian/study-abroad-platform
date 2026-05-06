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
  Gauge,
  History,
  Info,
  ListChecks,
  Target,
} from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PredictionHistoryTab } from './_components/PredictionHistoryTab';
import { EnterpriseStatusStrip, PageContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api/client';
import { schoolListRoutes, schoolRoutes, profileRoutes } from '@study-abroad/shared';
import { detectInternationalStatus } from '@study-abroad/shared/scoring';
import { usePredictionDashboard, useRunPrediction } from '@/hooks/use-prediction';
import {
  PredictionHeader,
  SchoolSelectorCard,
  DashboardSummary,
  PredictionResultList,
  AiContextActions,
  RecommendedSchoolsBlock,
} from '@/components/features/prediction';
import { AIErrorBoundary } from '@/components/features/ai-error-boundary';
import { Button } from '@/components/ui/button';
import type {
  PredictionResult,
  PredictionResponse,
  SchoolSearchItem,
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
  const statusT = useTranslations('enterpriseStatus');
  const searchParams = useSearchParams();
  const hasAutoRun = useRef(false);

  // School selection (pre-filled from user school list)
  const [activeTab, setActiveTab] = useState<'predict' | 'history'>('predict');
  const [selectedSchools, setSelectedSchools] = useState<SchoolSearchItem[]>([]);
  const [hasPreFilled, setHasPreFilled] = useState(false);
  const { data: schoolListData } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<SchoolListItemApi[]>(schoolListRoutes.list()),
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
  const { data: dashboardData } = usePredictionDashboard();
  const predictMutation = useRunPrediction();
  const { data: ucIdsData, isLoading: ucIdsLoading } = useQuery({
    queryKey: ['schools', 'uc-ids'],
    queryFn: () => apiClient.get<{ schoolIds: string[] }>(schoolRoutes.ucIds()),
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<any>(profileRoutes.me()),
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
    if (selectedSchools.length === 0) {
      toast.error(t('prediction.selectSchoolsFirst'));
      return;
    }
    const selectedIds = selectedSchools.map((s) => s.id);
    const ucIds = ucIdsData?.schoolIds ?? [];
    const hasAnyUc = ucIds.length > 0 && selectedIds.some((id) => ucIds.includes(id));
    const schoolIdsToUse = hasAnyUc ? ucIds : selectedIds;
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
  }, [selectedSchools, ucIdsData?.schoolIds, predictMutation.mutate, t]);

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
    if (searchParams.get('autorun') !== '1') return;
    if (!hasPreFilled || selectedSchools.length === 0 || predictMutation.isPending || ucIdsLoading)
      return;
    hasAutoRun.current = true;
    handlePredict();
  }, [
    handlePredict,
    hasPreFilled,
    predictMutation.isPending,
    searchParams,
    selectedSchools.length,
    ucIdsLoading,
  ]);

  return (
    <AIErrorBoundary feature="prediction">
      <PageContainer maxWidth="default">
        <PredictionHeader dataCompleteness={responseMetadata.dataCompleteness} />

        <EnterpriseStatusStrip
          title={statusT('prediction.title')}
          description={statusT('prediction.description')}
          items={[
            {
              tone: hasProfileGaps ? 'attention' : 'ready',
              label: statusT('prediction.profile'),
              value: hasProfileGaps ? statusT('states.attention') : statusT('states.ready'),
              description: statusT('prediction.profileDesc'),
              icon: ListChecks,
            },
            {
              tone: selectedSchools.length > 0 ? 'ready' : 'blocked',
              label: statusT('prediction.selection'),
              value:
                selectedSchools.length > 0
                  ? String(selectedSchools.length)
                  : statusT('states.blocked'),
              description: statusT('prediction.selectionDesc'),
              icon: Target,
            },
            {
              tone: results.length > 0 ? 'verified' : 'attention',
              label: statusT('prediction.confidence'),
              value:
                responseMetadata.dataCompleteness != null
                  ? `${responseMetadata.dataCompleteness}%`
                  : statusT('states.attention'),
              description: statusT('prediction.confidenceDesc'),
              icon: Gauge,
            },
            {
              tone: results.length > 0 ? 'ready' : 'attention',
              label: statusT('prediction.review'),
              value: results.length > 0 ? statusT('states.ready') : statusT('states.nextAction'),
              description: statusT('prediction.reviewDesc'),
              icon: CheckCircle2,
            },
          ]}
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'predict' | 'history')}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="predict" className="gap-1.5">
              <Target className="h-3.5 w-3.5" />
              {t('prediction.tabPredict')}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              {t('prediction.tabHistory')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'history' ? (
          <PredictionHistoryTab />
        ) : (
          <>
            {/* Data completeness checklist for sparse profiles */}
            {profileData && hasProfileGaps && (
              <div className="mb-4 rounded-[var(--theme-radius-card)] border border-warning/25 bg-warning/10 p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('prediction.dataChecklistTitle')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('prediction.dataChecklistDesc')}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {profileChecklist.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center gap-2 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-2.5 py-1.5 text-xs"
                        >
                          <CheckCircle2
                            className={
                              item.complete
                                ? 'h-3.5 w-3.5 text-success'
                                : 'h-3.5 w-3.5 text-muted-foreground'
                            }
                          />
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

            {dashboardData && dashboardData.totalSchools > 0 && (
              <DashboardSummary
                data={dashboardData}
                dataCompleteness={responseMetadata.dataCompleteness}
              />
            )}

            {ucIdsData?.schoolIds?.length && (
              <div className="mb-4 flex justify-end">
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

            <SchoolSelectorCard
              selectedSchools={selectedSchools}
              onAdd={handleAddSchool}
              onRemove={handleRemoveSchool}
              onPredict={handlePredict}
              isPredicting={predictMutation.isPending}
            />

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
                <AiContextActions results={results} selectedSchools={selectedSchools} />
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
          </>
        )}
      </PageContainer>
    </AIErrorBoundary>
  );
}
