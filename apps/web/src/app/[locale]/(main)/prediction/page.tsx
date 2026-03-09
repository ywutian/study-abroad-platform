'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api/client';
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

  // School selection (pre-filled from user school list)
  const [selectedSchools, setSelectedSchools] = useState<SchoolSearchItem[]>([]);
  const [hasPreFilled, setHasPreFilled] = useState(false);
  const { data: schoolListData } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<SchoolListItemApi[]>('/school-lists'),
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

  // Data fetching
  const { data: dashboardData } = usePredictionDashboard();
  const predictMutation = useRunPrediction();
  const { data: ucIdsData } = useQuery({
    queryKey: ['schools', 'uc-ids'],
    queryFn: () => apiClient.get<{ schoolIds: string[] }>('/schools/uc-ids'),
  });

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<any>('/profiles/me'),
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
      toast.info(t('prediction.ucComparisonExpanded'));
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
              toast.info(t('prediction.ucComparisonExpanded'));
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
  }, [ucIdsData?.schoolIds, predictMutation.mutate, t]);

  return (
    <AIErrorBoundary feature="prediction">
      <PageContainer maxWidth="default">
        <PredictionHeader dataCompleteness={responseMetadata.dataCompleteness} />

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
            <PredictionResultList
              results={results}
              expandedId={expandedId}
              onToggleExpand={handleToggleExpand}
              onResultReported={handleResultReported}
              onRefresh={handleRefreshSchool}
              refreshingSchoolId={refreshingSchoolId}
              isInternational={isInternational}
            />
            <RecommendedSchoolsBlock />
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
      </PageContainer>
    </AIErrorBoundary>
  );
}
