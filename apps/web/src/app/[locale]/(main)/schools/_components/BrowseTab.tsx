/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  FloatingAddButton,
  type SelectedSchool,
} from '@/components/features/schools/FloatingAddButton';
import {
  buildSchoolQueryParams,
  countActiveSchoolFilters,
  SCHOOL_DEFAULT_RANKING_LIST,
  SCHOOL_DEFAULT_RANKING_SOURCE,
  SCHOOL_BROWSE_DEFAULT_PAGE_SIZE,
  type SchoolRankingList,
  type SchoolSortBy,
  type SchoolWeightParams,
  type SchoolFilters,
} from '@/components/features/schools/school-filters';
import { useRouter } from '@/lib/i18n/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/stores/auth';
import { apiClient, STALE_TIME } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { schoolRoutes, schoolListRoutes, API_ROUTES } from '@study-abroad/shared';
import { NICHE_GRADE_QUERY_VALUES, type NicheGradeQueryValue } from '@study-abroad/shared/scoring';
import { toast } from 'sonner';

import { SchoolFilterBar } from './SchoolFilterBar';
import { SchoolGrid } from './SchoolGrid';
import { SchoolListView } from './SchoolListView';
import { SchoolPagination } from './SchoolPagination';
import { SchoolToolbar, type SchoolViewMode } from './SchoolToolbar';
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

interface AvailableCountry {
  code: string;
  count: number;
}

interface RankingListOption {
  source: 'US_NEWS';
  list: SchoolRankingList;
  labelKey: string;
  year: number | null;
  count: number;
  verifiedCount: number;
  fallbackCount: number;
  isDefault: boolean;
}

const WEIGHT_PRESETS: Record<string, SchoolWeightParams> = {
  balanced: { ranking: 30, acceptanceRate: 25, tuition: 25, salary: 20 },
  prestige: { ranking: 55, acceptanceRate: 25, tuition: 10, salary: 10 },
  affordability: { ranking: 15, acceptanceRate: 10, tuition: 60, salary: 15 },
  career: { ranking: 20, acceptanceRate: 10, tuition: 20, salary: 50 },
};

const defaultAdvancedFilters: SchoolFilters = {};

const RANKING_LIST_VALUES = new Set<SchoolRankingList>([
  'US_NEWS_CORE',
  'NATIONAL_UNIVERSITY',
  'LIBERAL_ARTS',
  'REGIONAL_UNIVERSITY',
  'ART_DESIGN',
  'MUSIC',
  'ENGINEERING_NO_PHD',
]);

const SORT_BY_VALUES = new Set<SchoolSortBy>(['rank', 'name', 'acceptance', 'salary', 'weighted']);

function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function boolParam(params: URLSearchParams, key: string): boolean | undefined {
  return params.get(key) === 'true' ? true : undefined;
}

function gradeParam(params: URLSearchParams, key: string): NicheGradeQueryValue | undefined {
  const raw = params.get(key)?.trim().toUpperCase();
  return NICHE_GRADE_QUERY_VALUES.includes(raw as NicheGradeQueryValue)
    ? (raw as NicheGradeQueryValue)
    : undefined;
}

function getInitialBrowseState() {
  if (typeof window === 'undefined') {
    return {
      search: '',
      country: 'ALL',
      sortBy: 'rank' as SchoolSortBy,
      rankingList: SCHOOL_DEFAULT_RANKING_LIST,
      page: 1,
      pageSize: SCHOOL_BROWSE_DEFAULT_PAGE_SIZE,
      filters: defaultAdvancedFilters,
      weights: WEIGHT_PRESETS.balanced,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const rawSortBy = params.get('sortBy') as SchoolSortBy | null;
  const rawRankingList = params.get('rankingList') as SchoolRankingList | null;
  const rawSchoolType = params.get('schoolType');
  const filters: SchoolFilters = {
    state: params.get('state') || undefined,
    region: params.get('region') || undefined,
    rankMin: numberParam(params, 'rankMin'),
    rankMax: numberParam(params, 'rankMax'),
    acceptanceMin: numberParam(params, 'acceptanceMin'),
    acceptanceMax: numberParam(params, 'acceptanceMax'),
    tuitionMin:
      numberParam(params, 'tuitionMin') != null
        ? Number(numberParam(params, 'tuitionMin')) / 10000
        : undefined,
    tuitionMax:
      numberParam(params, 'tuitionMax') != null
        ? Number(numberParam(params, 'tuitionMax')) / 10000
        : undefined,
    sizeMin: numberParam(params, 'sizeMin'),
    sizeMax: numberParam(params, 'sizeMax'),
    salaryMin:
      numberParam(params, 'salaryMin') != null
        ? Number(numberParam(params, 'salaryMin')) / 10000
        : undefined,
    salaryMax:
      numberParam(params, 'salaryMax') != null
        ? Number(numberParam(params, 'salaryMax')) / 10000
        : undefined,
    schoolType:
      rawSchoolType === 'public' || rawSchoolType === 'private' ? rawSchoolType : undefined,
    testOptional: boolParam(params, 'testOptional'),
    needBlind: boolParam(params, 'needBlind'),
    hasEarlyDecision: boolParam(params, 'hasEarlyDecision'),
    minSafetyGrade: gradeParam(params, 'minSafetyGrade'),
    minLifeGrade: gradeParam(params, 'minLifeGrade'),
    minFoodGrade: gradeParam(params, 'minFoodGrade'),
  };

  return {
    search: params.get('search') ?? '',
    country: params.get('country') ?? 'ALL',
    sortBy: rawSortBy && SORT_BY_VALUES.has(rawSortBy) ? rawSortBy : ('rank' as SchoolSortBy),
    rankingList:
      rawRankingList && RANKING_LIST_VALUES.has(rawRankingList)
        ? rawRankingList
        : SCHOOL_DEFAULT_RANKING_LIST,
    page: Math.max(1, numberParam(params, 'page') ?? 1),
    pageSize: Math.max(1, numberParam(params, 'pageSize') ?? SCHOOL_BROWSE_DEFAULT_PAGE_SIZE),
    filters,
    weights: {
      ranking: numberParam(params, 'weightRank') ?? WEIGHT_PRESETS.balanced.ranking,
      acceptanceRate:
        numberParam(params, 'weightAcceptance') ?? WEIGHT_PRESETS.balanced.acceptanceRate,
      tuition: numberParam(params, 'weightTuition') ?? WEIGHT_PRESETS.balanced.tuition,
      salary: numberParam(params, 'weightSalary') ?? WEIGHT_PRESETS.balanced.salary,
      campusSafety: numberParam(params, 'weightCampusSafety') ?? 0,
      campusLife: numberParam(params, 'weightCampusLife') ?? 0,
      campusFood: numberParam(params, 'weightCampusFood') ?? 0,
    },
  };
}

export function BrowseTab() {
  const t = useTranslations('schools');
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuthStore();
  const initialState = useMemo(() => getInitialBrowseState(), []);
  const didMountFiltersRef = useRef(false);

  // Filter state
  const [search, setSearch] = useState(initialState.search);
  // Debounce the search before it drives the query so typing doesn't fire a
  // network request per keystroke (the raw `search` still feeds the input).
  const debouncedSearch = useDebounce(search, 300);
  const [country, setCountry] = useState(initialState.country);
  const [sortBy, setSortBy] = useState<SchoolSortBy>(initialState.sortBy);
  const [rankingList, setRankingList] = useState<SchoolRankingList>(initialState.rankingList);
  const [advancedFilters, setAdvancedFilters] = useState<SchoolFilters>(initialState.filters);
  const [activePreset, setActivePreset] = useState<string>('balanced');
  const [fitWeights, setFitWeights] = useState<SchoolWeightParams>(initialState.weights);

  // Pagination state
  const [page, setPage] = useState(initialState.page);
  const [pageSize, setPageSize] = useState<number>(initialState.pageSize);

  // View state (localStorage-persisted)
  const [viewMode, setViewMode] = useState<SchoolViewMode>('card');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (v === 'card' || v === 'list') setViewMode(v);
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

  // Country list (fetched once, used for both filter dropdown and chip labels)
  const { data: availableCountries } = useQuery<AvailableCountry[]>({
    queryKey: ['schools', 'countries'],
    queryFn: () =>
      apiClient.get<AvailableCountry[]>(schoolRoutes.countries(), {
        suppressErrorToast: true,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rankingListOptions } = useQuery<RankingListOption[]>({
    queryKey: ['schools', 'ranking-lists', SCHOOL_DEFAULT_RANKING_SOURCE],
    queryFn: () =>
      apiClient.get<RankingListOption[]>(schoolRoutes.rankingLists(), {
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
    if (!didMountFiltersRef.current) {
      didMountFiltersRef.current = true;
      return;
    }
    setPage(1);
  }, [debouncedSearch, country, advancedFilters, sortBy, rankingList, fitWeights, pageSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextParams = buildSchoolQueryParams({
      search,
      country,
      filters: advancedFilters,
      page,
      pageSize,
      sortBy,
      rankingSource: SCHOOL_DEFAULT_RANKING_SOURCE,
      rankingList,
      weights: fitWeights,
    });
    const next = new URLSearchParams(nextParams);
    const nextQuery = next.toString();
    if (nextQuery === searchParams.toString()) return;
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [
    search,
    country,
    advancedFilters,
    sortBy,
    rankingList,
    fitWeights,
    page,
    pageSize,
    searchParams,
  ]);

  // Derived filter counts
  const activeAdvancedFilterCount = useMemo(
    () => countActiveSchoolFilters(advancedFilters, country),
    [advancedFilters, country]
  );

  const activeRankingListFilterCount = rankingList === SCHOOL_DEFAULT_RANKING_LIST ? 0 : 1;
  const activeFilterCount = activeAdvancedFilterCount + activeRankingListFilterCount;

  const hasFilters =
    !!search ||
    country !== 'ALL' ||
    activeAdvancedFilterCount > 0 ||
    activeRankingListFilterCount > 0;

  // Fetch schools
  const {
    data: schoolsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'schools',
      debouncedSearch,
      country,
      advancedFilters,
      sortBy,
      rankingList,
      fitWeights,
      page,
      pageSize,
    ],
    queryFn: () =>
      apiClient.get<{ items: School[]; total: number }>(schoolRoutes.list(), {
        params: buildSchoolQueryParams({
          search: debouncedSearch,
          country,
          filters: advancedFilters,
          page,
          pageSize,
          sortBy,
          rankingSource: SCHOOL_DEFAULT_RANKING_SOURCE,
          rankingList,
          weights: fitWeights,
        }),
        suppressErrorToast: true,
      }),
    // Static catalog data → cache 30 min so revisits are instant; keep the previous
    // results on screen during a refetch (page/filter change) instead of going blank.
    staleTime: STALE_TIME.STATIC,
    placeholderData: keepPreviousData,
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
        {
          id: school.id,
          name: school.name,
          nameZh: school.nameZh,
          usNewsRank: school.usNewsRank,
          rankings: school.rankings,
        },
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
    setRankingList(SCHOOL_DEFAULT_RANKING_LIST);
    setAdvancedFilters(defaultAdvancedFilters);
  }, []);

  return (
    <div className="grid w-full min-w-0 gap-6 overflow-x-clip lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <SchoolFilterBar
          search={search}
          onSearchChange={setSearch}
          country={country}
          onCountryChange={handleCountryChange}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          onResetAdvancedFilters={() => setAdvancedFilters(defaultAdvancedFilters)}
          onResetAll={resetAllFilters}
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

      <section className="min-w-0 max-w-full space-y-4 overflow-x-clip">
        <SchoolToolbar
          total={total}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          rankingList={rankingList}
          rankingListOptions={rankingListOptions}
          onRankingListChange={setRankingList}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
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
              preferredRankingList={rankingList}
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
            preferredRankingList={rankingList}
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
