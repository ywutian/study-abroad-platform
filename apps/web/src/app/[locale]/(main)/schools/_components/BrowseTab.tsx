/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  MapPin,
  Trophy,
  GraduationCap,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  Check,
  Filter,
  Globe,
  Users,
  Award,
  X,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { AdvancedSchoolFilter, SchoolFilters, SchoolLogo } from '@/components/features';
import { IndexGroup, IndexLegend } from '@/components/features/schools/IndexIndicators';
import { FloatingAddButton, SelectedSchool } from '@/components/features/schools/FloatingAddButton';
import { Link } from '@/lib/i18n/navigation';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { apiClient, STALE_TIME } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { type SchoolRanking } from '@/lib/utils/ranking';
import { cn, getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';
import { schoolRoutes, schoolListRoutes, API_ROUTES } from '@study-abroad/shared';
import { toast } from 'sonner';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  city?: string;
  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  tuition?: number;
  studentCount?: number;
  website?: string;
  logoUrl?: string;
  avgSalary?: number;
  totalEnrollment?: number;
  isPrivate?: boolean;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  acceptsCommonApp?: boolean;
  rankings?: SchoolRanking[];
}

interface Filters {
  schoolType: 'ALL' | 'PUBLIC' | 'PRIVATE';
  tuitionRange: string;
}

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

const countries = [
  { value: 'ALL', labelKey: 'all' },
  { value: 'US', labelKey: 'us' },
  { value: 'UK', labelKey: 'uk' },
  { value: 'CA', labelKey: 'canada' },
  { value: 'AU', labelKey: 'australia' },
  { value: 'DE', labelKey: 'germany' },
  { value: 'JP', labelKey: 'japan' },
];

const tuitionRanges = [
  { value: 'ALL', labelKey: 'all' },
  { value: '20-30', labelKey: '20k-30k' },
  { value: '30-40', labelKey: '30k-40k' },
  { value: '40-50', labelKey: '40k-50k' },
  { value: '50+', labelKey: '50k+' },
];

const getRankBadgeStyle = (rank: number) => {
  if (rank <= 10) return 'bg-warning text-white';
  if (rank <= 30) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (rank <= 50) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  return 'bg-muted text-muted-foreground';
};

const defaultAdvancedFilters: SchoolFilters = {};

export function BrowseTab() {
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('ALL');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'acceptance' | 'weighted'>('rank');
  const [advancedFilters, setAdvancedFilters] = useState<SchoolFilters>(defaultAdvancedFilters);
  const [filters, setFilters] = useState<Filters>({ schoolType: 'ALL', tuitionRange: 'ALL' });
  const [activePreset, setActivePreset] = useState<string>('selectivity');
  const [addedSchools, setAddedSchools] = useState<Set<string>>(new Set());
  const [selectedSchools, setSelectedSchools] = useState<SelectedSchool[]>([]);

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
              action: { label: t('viewTimeline'), onClick: () => router.push('timeline') },
            });
          } else {
            toast.warning(t('timelineGenerateFailed'));
          }
        } else {
          toast.success(t('batchAddSuccess', { count: successCount }), {
            description: t('timelineGenerated'),
            action: { label: t('viewTimeline'), onClick: () => router.push('timeline') },
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
  const hasFilters =
    search || country !== 'ALL' || activeAdvancedFilterCount > 0 || activeFilterCount > 0;

  const resetAdvancedFilters = () => setAdvancedFilters(defaultAdvancedFilters);

  // Sort schools
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

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Country Filter */}
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('country')} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {t(`countries.${c.labelKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">{t('sort.rank')}</SelectItem>
                <SelectItem value="name">{t('sort.name')}</SelectItem>
                <SelectItem value="acceptance">{t('sort.acceptance')}</SelectItem>
                <SelectItem value="weighted">{t('weightSort')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick Filters Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {t('allFilters')}
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium">{t('filterOptions')}</h4>
                  <div className="space-y-2">
                    <Label>{t('schoolType')}</Label>
                    <Select
                      value={filters.schoolType}
                      onValueChange={(v) =>
                        setFilters((prev) => ({ ...prev, schoolType: v as any }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">{tc('all')}</SelectItem>
                        <SelectItem value="PUBLIC">{t('public')}</SelectItem>
                        <SelectItem value="PRIVATE">{t('private')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('tuitionRange')}</Label>
                    <Select
                      value={filters.tuitionRange}
                      onValueChange={(v) => setFilters((prev) => ({ ...prev, tuitionRange: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tuitionRanges.map((range) => (
                          <SelectItem key={range.value} value={range.value}>
                            {t(`tuition.${range.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setFilters({ schoolType: 'ALL', tuitionRange: 'ALL' })}
                  >
                    {t('resetFilters')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Advanced Filter */}
            <AdvancedSchoolFilter
              filters={advancedFilters}
              onChange={setAdvancedFilters}
              onReset={resetAdvancedFilters}
              activeCount={activeAdvancedFilterCount}
            />
          </div>

          {/* Active Filters */}
          {(search || country !== 'ALL') && (
            <div className="flex flex-wrap gap-2 mt-4">
              {search && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Search className="h-3 w-3" />
                  {search}
                  <button
                    onClick={() => setSearch('')}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {country !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Globe className="h-3 w-3" />
                  {t(`countries.${countries.find((c) => c.value === country)?.labelKey}`)}
                  <button
                    onClick={() => setCountry('ALL')}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* Weight Presets (shown when weighted sort is selected) */}
          <Collapsible open={sortBy === 'weighted'}>
            <CollapsibleContent>
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <SlidersHorizontal className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{t('presets.title')}</h4>
                    <p className="text-xs text-muted-foreground">{t('presets.description')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(WEIGHT_PRESETS).map((key) => (
                    <Button
                      key={key}
                      variant={activePreset === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActivePreset(key)}
                    >
                      {t(`presets.${key}`)}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" className="gap-1" asChild>
                    <Link href="/ranking">
                      {t('presets.customRanking')}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Index Legend */}
      {accessToken && <IndexLegend className="mb-0" />}

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('resultsCount', { count: total })}</p>
        {selectedSchools.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            {t('selectedCount', { count: selectedSchools.length })}
          </Badge>
        )}
      </div>

      {/* Schools Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-1 bg-primary/20" />
              <CardContent className="pt-4">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-4 w-2/3 mb-3" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="overflow-hidden">
          <div className="h-1 bg-destructive" />
          <CardContent className="py-8">
            <EmptyState
              type="error"
              title={t('loadError')}
              description={t('loadErrorDesc')}
              action={{ label: tc('retry'), onClick: () => refetch() }}
              size="lg"
            />
          </CardContent>
        </Card>
      ) : sortedSchools.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSchools.map((school, index) => {
            const isSelected = isSchoolSelected(school.id);
            const isAdded = addedSchools.has(school.id);

            return (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card
                  className={cn(
                    'h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer group overflow-hidden',
                    isSelected && 'ring-2 ring-primary/50 bg-primary/5'
                  )}
                >
                  <div className="h-1 bg-primary group-hover:h-1.5 transition-all" />
                  <CardContent className="pt-4">
                    {/* Batch selection checkbox */}
                    {accessToken && (
                      <div className="flex items-center justify-end mb-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleSchoolSelection(school, checked as boolean)
                          }
                          disabled={isAdded}
                          className="shrink-0"
                        />
                      </div>
                    )}

                    <Link href={`/schools/${school.id}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <SchoolLogo
                          logoUrl={school.logoUrl}
                          name={getSchoolName(school, locale)}
                          size="md"
                          className="border-violet-500/20 group-hover:border-violet-500/40 group-hover:scale-105 transition-all"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                              {getSchoolName(school, locale)}
                            </h3>
                            <RankingBadge
                              rankings={school.rankings}
                              usNewsRank={school.usNewsRank}
                              variant="amber"
                            />
                          </div>
                          {getSchoolSubName(school, locale) && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {getSchoolSubName(school, locale)}
                            </p>
                          )}
                        </div>
                      </div>

                      {(school.testOptional || school.hasEarlyDecision) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {school.testOptional && (
                            <Badge variant="outline" className="text-xs">
                              {t('specialConditions.testOptional')}
                            </Badge>
                          )}
                          {school.hasEarlyDecision && (
                            <Badge variant="outline" className="text-xs">
                              ED
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="truncate">
                          {school.city && `${school.city}, `}
                          {school.state && `${school.state}, `}
                          {school.country}
                        </span>
                      </div>

                      {/* Data metrics */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/50 group-hover:bg-muted/70 transition-colors">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                            <Award className="h-3 w-3" />
                            {t('acceptanceRate')}
                          </div>
                          <div
                            className={cn(
                              'font-semibold text-sm',
                              school.acceptanceRate && school.acceptanceRate < 15
                                ? 'text-rose-500'
                                : school.acceptanceRate && school.acceptanceRate < 30
                                  ? 'text-amber-500'
                                  : ''
                            )}
                          >
                            {formatAcceptanceRate(school.acceptanceRate)}
                          </div>
                        </div>
                        <div className="text-center border-l border-border">
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            {t('students')}
                          </div>
                          <div className="font-semibold text-sm">
                            {school.studentCount
                              ? format.number(school.studentCount, 'standard')
                              : '-'}
                          </div>
                        </div>
                      </div>
                    </Link>

                    {/* Add to List Button */}
                    {accessToken && (
                      <div className="mt-3 flex items-center justify-between">
                        <IndexGroup
                          safetyGrade={school.nicheSafetyGrade}
                          lifeGrade={school.nicheLifeGrade}
                          foodGrade={school.nicheFoodGrade}
                          className="flex"
                        />
                        {isAdded ? (
                          <Button variant="secondary" size="sm" disabled>
                            <Check className="h-4 w-4 mr-1" />
                            {t('added')}
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={addToListMutation.isPending}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                {t('addToList')}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {(['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const).map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  onClick={() =>
                                    addToListMutation.mutate({ schoolId: school.id, round: r })
                                  }
                                  disabled={addToListMutation.isPending}
                                >
                                  {t('rounds.' + r)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}

                    {!accessToken && (
                      <div className="mt-3 flex items-center justify-end text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {t('viewDetails')}
                        <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary/40" />
          <CardContent className="py-8">
            {hasFilters ? (
              <EmptyState
                type="no-results"
                title={t('noResults')}
                description={t('noResultsDesc')}
                action={{
                  label: t('resetFilters'),
                  onClick: () => {
                    setSearch('');
                    setCountry('ALL');
                    setFilters({ schoolType: 'ALL', tuitionRange: 'ALL' });
                    resetAdvancedFilters();
                  },
                  variant: 'outline',
                  icon: <X className="h-4 w-4" />,
                }}
                size="lg"
              />
            ) : (
              <EmptyState
                type="schools"
                title={t('noResults')}
                description={t('noResultsDesc')}
                action={{
                  label: tc('retry'),
                  onClick: () => refetch(),
                  icon: <GraduationCap className="h-4 w-4" />,
                }}
                size="lg"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom spacer for floating bar */}
      {selectedSchools.length > 0 && <div className="h-16" />}

      {/* Floating batch add bar */}
      <FloatingAddButton
        selectedSchools={selectedSchools}
        onAdd={handleBatchAdd}
        onRemove={(id) => setSelectedSchools((prev) => prev.filter((s) => s.id !== id))}
        onClear={() => setSelectedSchools([])}
        isAdding={batchAddMutation.isPending}
      />
    </div>
  );
}
