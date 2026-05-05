/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FloatingAddButton,
  type SelectedSchool,
} from '@/components/features/schools/FloatingAddButton';
import {
  buildSchoolQueryParams,
  countActiveSchoolFilters,
  SCHOOL_BROWSE_DEFAULT_PAGE_SIZE,
  type SchoolSortBy,
  type SchoolWeightParams,
  type SchoolFilters,
} from '@/components/features/schools/school-filters';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import { apiClient, STALE_TIME } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { schoolRoutes, schoolListRoutes, API_ROUTES } from '@study-abroad/shared';
import { toast } from 'sonner';

import { SchoolFilterBar } from './SchoolFilterBar';
import { SchoolGrid } from './SchoolGrid';
import { SchoolListView } from './SchoolListView';
import { SchoolPagination } from './SchoolPagination';
import { SchoolToolbar, type SchoolDensity, type SchoolViewMode } from './SchoolToolbar';
import { type School } from './schools-types';

const COUNTRY_LABEL_KEYS: Record<string, string> = {
  US: 'us',
  USA: 'us',
  UK: 'uk',
  GB: 'uk',
  CA: 'canada',
  AU: 'australia',
  DE: 'germany',
  JP: 'japan',
};

const VIEW_STORAGE_KEY = 'schools.browse.viewMode';
const DENSITY_STORAGE_KEY = 'schools.browse.density';

interface AvailableCountry {
  code: string;
  count: number;
}

const WEIGHT_PRESETS: Record<string, SchoolWeightParams> = {
  balanced: { ranking: 30, acceptanceRate: 25, tuition: 25, salary: 20 },
  prestige: { ranking: 55, acceptanceRate: 25, tuition: 10, salary: 10 },
  affordability: { ranking: 15, acceptanceRate: 10, tuition: 60, salary: 15 },
  career: { ranking: 20, acceptanceRate: 10, tuition: 20, salary: 50 },
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
  const [sortBy, setSortBy] = useState<SchoolSortBy>('rank');
  const [advancedFilters, setAdvancedFilters] = useState<SchoolFilters>(defaultAdvancedFilters);
  const [activePreset, setActivePreset] = useState<string>('balanced');
  const [fitWeights, setFitWeights] = useState<SchoolWeightParams>(WEIGHT_PRESETS.balanced);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(SCHOOL_BROWSE_DEFAULT_PAGE_SIZE);

  // View / density state (localStorage-persisted)
  const [viewMode, setViewMode] = useState<SchoolViewMode>('card');
  const [density, setDensity] = useState<SchoolDensity>('comfortable');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (v === 'card' || v === 'list') setViewMode(v);
      const d = window.localStorage.getItem(DENSITY_STORAGE_KEY);
      if (d === 'comfortable' || d === 'compact') setDensity(d);
    } catch {
      /* ignore */
    }
  }, []);

  const handleViewModeChange = useCallback((mode: SchoolViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleDensityChange = useCallback((d: SchoolDensity) => {
    setDensity(d);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, d);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Country list (fetched once, used for both filter dropdown and chip labels)
  const { data: availableCountries } = useQuery<AvailableCountry[]>({
    queryKey: ['schools', 'countries'],
    queryFn: () =>
      apiClient.get<AvailableCountry[]>(schoolRoutes.countries(), {
        suppressErrorToast: true,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const countriesT = useTranslations('schools.countries');
  const countryLabel = useMemo(() => {
    if (country === 'ALL') return '';
    const labelKey = COUNTRY_LABEL_KEYS[country] ?? country.toLowerCase();
    try {
      return countriesT(labelKey as any);
    } catch {
      return country;
    }
  }, [country, countriesT]);
  const showCountryFilter = (availableCountries?.length ?? 0) > 1;

  // Selection state
  const [addedSchools, setAddedSchools] = useState<Set<string>>(new Set());
  const [selectedSchools, setSelectedSchools] = useState<SelectedSchool[]>([]);

  // Reset to page 1 whenever any filter / sort / weight / pageSize changes
  useEffect(() => {
    setPage(1);
  }, [search, country, advancedFilters, sortBy, fitWeights, pageSize]);

  // Derived filter counts
  const activeAdvancedFilterCount = useMemo(
    () => countActiveSchoolFilters(advancedFilters, country),
    [advancedFilters, country]
  );

  const activeFilterCount = activeAdvancedFilterCount;

  const hasFilters = !!search || country !== 'ALL' || activeAdvancedFilterCount > 0;

  // Fetch schools
  const {
    data: schoolsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['schools', search, country, advancedFilters, sortBy, fitWeights, page, pageSize],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>(schoolRoutes.list(), {
        params: buildSchoolQueryParams({
          search,
          country,
          filters: advancedFilters,
          page,
          pageSize,
          sortBy,
          weights: fitWeights,
        }),
        suppressErrorToast: true,
      }),
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

  const schools = useMemo(() => schoolsData?.items || [], [schoolsData?.items]);
  const total = schoolsData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

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

  const handleCountryChange = useCallback((value: string) => {
    setCountry(value);
    if (value !== 'US') {
      setAdvancedFilters((prev) => ({
        ...prev,
        state: undefined,
        region: undefined,
      }));
    }
  }, []);

  const resetAllFilters = useCallback(() => {
    setSearch('');
    setCountry('ALL');
    setAdvancedFilters(defaultAdvancedFilters);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SchoolFilterBar
          search={search}
          onSearchChange={setSearch}
          country={country}
          onCountryChange={handleCountryChange}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          onResetAdvancedFilters={() => setAdvancedFilters(defaultAdvancedFilters)}
          activeAdvancedFilterCount={activeAdvancedFilterCount}
          activeFilterCount={activeFilterCount}
          activePreset={activePreset}
          onActivePresetChange={(preset) => {
            setActivePreset(preset);
            setFitWeights(WEIGHT_PRESETS[preset] ?? fitWeights);
            setSortBy('weighted');
          }}
          weightPresetKeys={Object.keys(WEIGHT_PRESETS)}
          fitWeights={fitWeights}
          onFitWeightsChange={(weights) => {
            setActivePreset('custom');
            setFitWeights(weights);
            setSortBy('weighted');
          }}
        />
      </aside>

      <section className="min-w-0 space-y-4">
        <SchoolToolbar
          total={total}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          density={density}
          onDensityChange={handleDensityChange}
          search={search}
          onClearSearch={() => setSearch('')}
          country={country}
          showCountryChip={showCountryFilter}
          countryLabel={countryLabel}
          onClearCountry={() => handleCountryChange('ALL')}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          onResetAll={resetAllFilters}
        />

        {viewMode === 'list' && !isLoading && !isError && schools.length > 0 ? (
          <>
            <SchoolListView
              schools={schools}
              hasAuth={!!accessToken}
              onToggleSelection={toggleSchoolSelection}
              isSchoolSelected={isSchoolSelected}
              addedSchools={addedSchools}
              onAddToList={(schoolId, round) => addToListMutation.mutate({ schoolId, round })}
              isAddingToList={addToListMutation.isPending}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              density={density}
            />
            <SchoolPagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <SchoolGrid
            schools={schools}
            total={total}
            isLoading={isLoading}
            isError={isError}
            onRefetch={() => refetch()}
            hasAuth={!!accessToken}
            onToggleSelection={toggleSchoolSelection}
            isSchoolSelected={isSchoolSelected}
            addedSchools={addedSchools}
            onAddToList={(schoolId, round) => addToListMutation.mutate({ schoolId, round })}
            isAddingToList={addToListMutation.isPending}
            hasFilters={hasFilters}
            onResetAllFilters={resetAllFilters}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onPageSizeChange={setPageSize}
            density={density}
          />
        )}

        {/* Bottom spacer for floating bar (shared by both views) */}
        {selectedSchools.length > 0 && <div className="h-16" />}

        {/* Floating batch add bar (shared by both views) */}
        <FloatingAddButton
          selectedSchools={selectedSchools}
          onAdd={handleBatchAdd}
          onRemove={(id) => setSelectedSchools((prev) => prev.filter((s) => s.id !== id))}
          onClear={() => setSelectedSchools([])}
          isAdding={batchAddMutation.isPending}
        />
      </section>
    </div>
  );
}
