/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SchoolFilters } from '@/components/features';
import { type SelectedSchool } from '@/components/features/schools/FloatingAddButton';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import { apiClient, STALE_TIME } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { schoolRoutes, schoolListRoutes, API_ROUTES } from '@study-abroad/shared';
import { toast } from 'sonner';

import { SchoolFilterBar } from './SchoolFilterBar';
import { SchoolGrid } from './SchoolGrid';
import { type School, type Filters } from './schools-types';

interface WeightPreset {
  ranking: number;
  salary: number;
  tuition: number;
  acceptanceRate: number;
}

const WEIGHT_PRESETS: Record<string, WeightPreset> = {
  selectivity: { ranking: 50, acceptanceRate: 30, tuition: 10, salary: 10 },
  affordability: { ranking: 15, acceptanceRate: 10, tuition: 50, salary: 25 },
  employment: { ranking: 20, acceptanceRate: 10, tuition: 15, salary: 55 },
};

const defaultAdvancedFilters: SchoolFilters = {};

export function BrowseTab() {
  const t = useTranslations('schools');
  const queryClient = useQueryClient();
  const router = useRouter();
  const { accessToken } = useAuthStore();

  // Filter state
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('ALL');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'acceptance' | 'weighted'>('rank');
  const [advancedFilters, setAdvancedFilters] = useState<SchoolFilters>(defaultAdvancedFilters);
  const [filters, setFilters] = useState<Filters>({ schoolType: 'ALL', tuitionRange: 'ALL' });
  const [activePreset, setActivePreset] = useState<string>('selectivity');

  // Selection state
  const [addedSchools, setAddedSchools] = useState<Set<string>>(new Set());
  const [selectedSchools, setSelectedSchools] = useState<SelectedSchool[]>([]);

  // Derived filter counts
  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.rankMin || advancedFilters.rankMax) count++;
    if (advancedFilters.acceptanceMin || advancedFilters.acceptanceMax) count++;
    if (advancedFilters.tuitionMin || advancedFilters.tuitionMax) count++;
    if (advancedFilters.sizeMin || advancedFilters.sizeMax) count++;
    if (advancedFilters.state) count++;
    if (advancedFilters.region) count++;
    if (advancedFilters.schoolType) count++;
    if (advancedFilters.testOptional) count++;
    if (advancedFilters.needBlind) count++;
    if (advancedFilters.hasEarlyDecision) count++;
    return count;
  }, [advancedFilters]);

  const activeFilterCount =
    (filters.schoolType !== 'ALL' ? 1 : 0) + (filters.tuitionRange !== 'ALL' ? 1 : 0);

  const hasFilters =
    !!search || country !== 'ALL' || activeAdvancedFilterCount > 0 || activeFilterCount > 0;

  // Fetch schools
  const {
    data: schoolsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['schools', search, country, filters, advancedFilters],
    queryFn: () => {
      const params: Record<string, string> = { pageSize: '100' };
      if (search) params.search = search;
      if (country && country !== 'ALL') params.country = country;
      if (filters.schoolType !== 'ALL') {
        params.isPrivate = (filters.schoolType === 'PRIVATE').toString();
      }
      if (filters.tuitionRange !== 'ALL') {
        const [min, max] = filters.tuitionRange.split('-');
        if (min) params.tuitionMin = (parseInt(min) * 1000).toString();
        if (max) params.tuitionMax = (parseInt(max) * 1000).toString();
        if (filters.tuitionRange === '50+') {
          params.tuitionMin = '50000';
        }
      }
      // Advanced filters
      if (advancedFilters.rankMin) params.rankMin = advancedFilters.rankMin.toString();
      if (advancedFilters.rankMax) params.rankMax = advancedFilters.rankMax.toString();
      if (advancedFilters.acceptanceMin)
        params.acceptanceMin = advancedFilters.acceptanceMin.toString();
      if (advancedFilters.acceptanceMax)
        params.acceptanceMax = advancedFilters.acceptanceMax.toString();
      if (advancedFilters.tuitionMin)
        params.tuitionMin = (advancedFilters.tuitionMin * 10000).toString();
      if (advancedFilters.tuitionMax)
        params.tuitionMax = (advancedFilters.tuitionMax * 10000).toString();
      if (advancedFilters.sizeMin) params.sizeMin = advancedFilters.sizeMin.toString();
      if (advancedFilters.sizeMax) params.sizeMax = advancedFilters.sizeMax.toString();
      if (advancedFilters.state) params.state = advancedFilters.state;
      if (advancedFilters.region) params.region = advancedFilters.region;
      if (advancedFilters.schoolType) params.schoolType = advancedFilters.schoolType;
      if (advancedFilters.testOptional) params.testOptional = 'true';
      if (advancedFilters.needBlind) params.needBlind = 'true';
      if (advancedFilters.hasEarlyDecision) params.hasEarlyDecision = 'true';
      return apiClient.get<{ items: School[]; total: number }>(schoolRoutes.list(), { params });
    },
    staleTime: STALE_TIME.DYNAMIC,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Add single school to list
  const addToListMutation = useMutation({
    mutationFn: ({ schoolId, round }: { schoolId: string; round: string }) =>
      apiClient.post(schoolListRoutes.list(), { schoolId, tier: 'TARGET', round }),
    onSuccess: (_, { schoolId }) => {
      setAddedSchools((prev) => new Set([...prev, schoolId]));
      toast.success(t('addedToList'));
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        toast.info(t('alreadyInList'));
      }
    },
    meta: { skipGlobalErrorToast: true },
  });

  // Batch add
  const batchAddMutation = useMutation({
    mutationFn: async ({
      schoolIds,
      tier,
      round,
    }: {
      schoolIds: string[];
      tier: string;
      round?: string;
    }) => {
      const results = await Promise.allSettled(
        schoolIds.map((schoolId) =>
          apiClient.post(schoolListRoutes.list(), { schoolId, tier, ...(round && { round }) })
        )
      );
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      return { successCount, total: schoolIds.length, schoolIds };
    },
    onSuccess: async ({ successCount, schoolIds }) => {
      selectedSchools.forEach((s) => {
        setAddedSchools((prev) => new Set([...prev, s.id]));
      });
      setSelectedSchools([]);
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });

      try {
        const tlResult = await apiClient.post<{
          created: any[];
          failed: Array<{ schoolId: string; reason: string }>;
        }>(`${API_ROUTES.TIMELINES}/generate`, { schoolIds });
        queryClient.invalidateQueries({ queryKey: ['timelines'] });

        if (tlResult.failed && tlResult.failed.length > 0) {
          if (tlResult.created.length > 0) {
            toast.warning(t('timelinePartialFail', { failed: tlResult.failed.length }), {
              action: { label: t('viewTimeline'), onClick: () => router.push('/timeline') },
            });
          } else {
            toast.warning(t('timelineGenerateFailed'));
          }
        } else {
          toast.success(t('batchAddSuccess', { count: successCount }), {
            description: t('timelineGenerated'),
            action: { label: t('viewTimeline'), onClick: () => router.push('/timeline') },
          });
        }
      } catch {
        toast.success(t('batchAddSuccess', { count: successCount }), {
          description: t('timelineGenerateFailedHint'),
        });
      }
    },
    onError: () => {
      toast.error(t('addFailed'));
    },
  });

  // Sorted schools
  const schools = useMemo(() => schoolsData?.items || [], [schoolsData?.items]);
  const total = schoolsData?.total || 0;

  const sortedSchools = useMemo(() => {
    if (!schools.length) return [];
    const sorted = [...schools];

    if (sortBy === 'weighted') {
      const weights = WEIGHT_PRESETS[activePreset] || WEIGHT_PRESETS.selectivity;
      return sorted.sort((a, b) => {
        const getScore = (school: School) => {
          let score = 0;
          const totalWeight =
            weights.ranking + weights.salary + weights.tuition + weights.acceptanceRate;
          if (school.usNewsRank && weights.ranking > 0) {
            const rankScore = Math.max(0, 100 - (school.usNewsRank - 1));
            score += (rankScore * weights.ranking) / totalWeight;
          }
          if (school.avgSalary && weights.salary > 0) {
            const salaryScore = Math.min(100, school.avgSalary / 1500);
            score += (salaryScore * weights.salary) / totalWeight;
          }
          if (school.tuition && weights.tuition > 0) {
            const tuitionScore = Math.max(0, 100 - school.tuition / 800);
            score += (tuitionScore * weights.tuition) / totalWeight;
          }
          if (school.acceptanceRate && weights.acceptanceRate > 0) {
            const acceptScore = Number(school.acceptanceRate);
            score += (acceptScore * weights.acceptanceRate) / totalWeight;
          }
          return score;
        };
        return getScore(b) - getScore(a);
      });
    }

    switch (sortBy) {
      case 'rank':
        return sorted.sort((a, b) => (a.usNewsRank || 999) - (b.usNewsRank || 999));
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'acceptance':
        return sorted.sort((a, b) => (a.acceptanceRate || 100) - (b.acceptanceRate || 100));
      default:
        return sorted;
    }
  }, [schools, sortBy, activePreset]);

  // Callbacks
  const toggleSchoolSelection = useCallback((school: School, checked: boolean) => {
    if (checked) {
      setSelectedSchools((prev) => [
        ...prev,
        { id: school.id, name: school.name, nameZh: school.nameZh, usNewsRank: school.usNewsRank },
      ]);
    } else {
      setSelectedSchools((prev) => prev.filter((s) => s.id !== school.id));
    }
  }, []);

  const isSchoolSelected = useCallback(
    (schoolId: string) => selectedSchools.some((s) => s.id === schoolId),
    [selectedSchools]
  );

  const handleBatchAdd = useCallback(
    (schoolIds: string[], tier: string, round: string) => {
      batchAddMutation.mutate({ schoolIds, tier, round });
    },
    [batchAddMutation]
  );

  const resetAllFilters = useCallback(() => {
    setSearch('');
    setCountry('ALL');
    setFilters({ schoolType: 'ALL', tuitionRange: 'ALL' });
    setAdvancedFilters(defaultAdvancedFilters);
  }, []);

  return (
    <div className="space-y-6">
      <SchoolFilterBar
        search={search}
        onSearchChange={setSearch}
        country={country}
        onCountryChange={setCountry}
        sortBy={sortBy}
        onSortByChange={(v) => setSortBy(v as any)}
        filters={filters}
        onFiltersChange={setFilters}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        onResetAdvancedFilters={() => setAdvancedFilters(defaultAdvancedFilters)}
        activeAdvancedFilterCount={activeAdvancedFilterCount}
        activeFilterCount={activeFilterCount}
        activePreset={activePreset}
        onActivePresetChange={setActivePreset}
        weightPresetKeys={Object.keys(WEIGHT_PRESETS)}
      />

      <SchoolGrid
        schools={sortedSchools}
        total={total}
        isLoading={isLoading}
        isError={isError}
        onRefetch={() => refetch()}
        hasAuth={!!accessToken}
        selectedSchools={selectedSchools}
        onToggleSelection={toggleSchoolSelection}
        isSchoolSelected={isSchoolSelected}
        addedSchools={addedSchools}
        onAddToList={(schoolId, round) => addToListMutation.mutate({ schoolId, round })}
        isAddingToList={addToListMutation.isPending}
        hasFilters={hasFilters}
        onResetAllFilters={resetAllFilters}
        onBatchAdd={handleBatchAdd}
        onRemoveSelected={(id) => setSelectedSchools((prev) => prev.filter((s) => s.id !== id))}
        onClearSelected={() => setSelectedSchools([])}
        isBatchAdding={batchAddMutation.isPending}
      />
    </div>
  );
}
