'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';
import { usePredictionDashboard, useRunPrediction } from '@/hooks/use-prediction';
import {
  PredictionHeader,
  SchoolSelectorCard,
  DashboardSummary,
  PredictionResultList,
  AiContextActions,
} from '@/components/features/prediction';
import type {
  PredictionResult,
  PredictionResponse,
  SchoolSearchItem,
} from '@/components/features/prediction';

export default function PredictionPage() {
  const t = useTranslations();

  // School selection
  const [selectedSchools, setSelectedSchools] = useState<SchoolSearchItem[]>([]);

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
    predictMutation.mutate(
      { schoolIds: selectedSchools.map((s) => s.id), forceRefresh: true },
      {
        onSuccess: (data) => {
          const predictionResults = data.results || [];
          setResults(predictionResults);
          setResponseMetadata({
            dataCompleteness: data.dataCompleteness,
            memoryContext: data.memoryContext,
            processingTime: data.processingTime,
          });
          if (predictionResults.length > 0) {
            toast.success(t('prediction.successMessage', { count: predictionResults.length }));
          } else {
            toast.info(t('prediction.noResult'));
          }
        },
      }
    );
  }, [selectedSchools, predictMutation.mutate, t]);

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

  return (
    <PageContainer maxWidth="default">
      <PredictionHeader dataCompleteness={responseMetadata.dataCompleteness} />

      {dashboardData && dashboardData.totalSchools > 0 && (
        <DashboardSummary
          data={dashboardData}
          dataCompleteness={responseMetadata.dataCompleteness}
        />
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
          />
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
  );
}
