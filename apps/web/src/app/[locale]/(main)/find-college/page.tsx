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
  ChevronDown,
  SlidersHorizontal,
  DollarSign,
  Plus,
  Check,
  TrendingUp,
  Percent,
  Filter,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from '@/lib/i18n/navigation';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { cn, getSchoolName } from '@/lib/utils';
import { toast } from 'sonner';

// 新组件
import { IndexGroup, IndexLegend } from '@/components/features/schools/IndexIndicators';
import { FloatingAddButton, SelectedSchool } from '@/components/features/schools/FloatingAddButton';

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
  avgSalary?: number;
  totalEnrollment?: number;
  isPrivate?: boolean;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
}

interface Filters {
  schoolType: 'ALL' | 'PUBLIC' | 'PRIVATE';
  tuitionRange: string;
}

interface Weights {
  ranking: number;
  salary: number;
  tuition: number;
  acceptanceRate: number;
}

const tuitionRanges = [
  { value: 'ALL', labelKey: 'all' },
  { value: '20-30', labelKey: '20k-30k' },
  { value: '30-40', labelKey: '30k-40k' },
  { value: '40-50', labelKey: '40k-50k' },
  { value: '50+', labelKey: '50k+' },
];

// 权重滑块项组件
interface WeightSliderItemProps {
  icon: typeof Trophy;
  iconBg: string;
  iconColor: string;
  barColor: string;
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}

function WeightSliderItem({
  icon: Icon,
  iconBg,
  iconColor,
  barColor,
  label,
  description,
  value,
  onChange,
}: WeightSliderItemProps) {
  return (
    <motion.div className="group" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <span className="flex-1 text-sm font-medium">{label}</span>
        <div className="px-3 py-1 rounded-full bg-muted border border-border/50 text-xs font-semibold tabular-nums min-w-[52px] text-center">
          {value}%
        </div>
      </div>

      <div className="ml-12">
        <div className="relative">
          <div className="absolute inset-0 h-2 rounded-full bg-muted" />
          <motion.div
            className={cn('absolute h-2 rounded-full', barColor)}
            initial={false}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
          <Slider
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            max={100}
            step={5}
            className={cn(
              'relative',
              '[&_[data-slot=slider-track]]:bg-transparent',
              '[&_[data-slot=slider-range]]:bg-transparent',
              '[&_[data-slot=slider-thumb]]:border-2',
              '[&_[data-slot=slider-thumb]]:shadow-md',
              '[&_[data-slot=slider-thumb]]:transition-transform',
              '[&_[data-slot=slider-thumb]]:hover:scale-110',
              iconColor.replace('text-', '[&_[data-slot=slider-thumb]]:border-')
            )}
          />
        </div>
        {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </div>
    </motion.div>
  );
}

export default function FindCollegePage() {
  const t = useTranslations('findCollege');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({
    schoolType: 'ALL',
    tuitionRange: 'ALL',
  });
  const [weights, setWeights] = useState<Weights>({
    ranking: 40,
    salary: 20,
    tuition: 20,
    acceptanceRate: 20,
  });
  const [showWeights, setShowWeights] = useState(false);
  const [addedSchools, setAddedSchools] = useState<Set<string>>(new Set());
  const [selectedSchools, setSelectedSchools] = useState<SelectedSchool[]>([]);

  // Fetch schools
  const {
    data: schoolsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['find-college-schools', search, filters],
    queryFn: () => {
      const params: Record<string, string> = { pageSize: '100' };
      if (search) params.search = search;
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
      return apiClient.get<{ items: School[]; total: number }>('/schools', { params });
    },
    staleTime: 60 * 1000,
  });

  // Add single school to list mutation
  const addToListMutation = useMutation({
    mutationFn: (schoolId: string) => apiClient.post('/school-lists', { schoolId, tier: 'TARGET' }),
    onSuccess: (_, schoolId) => {
      setAddedSchools((prev) => new Set([...prev, schoolId]));
      toast.success(t('addedToList'));
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
    },
    onError: (error: any) => {
      if (error.message?.includes('already exists')) {
        toast.info(t('alreadyInList'));
      } else {
        toast.error(error.message || t('addFailed'));
      }
    },
  });

  const router = useRouter();

  // Batch add schools mutation
  const batchAddMutation = useMutation({
    mutationFn: async (schoolIds: string[]) => {
      const results = await Promise.allSettled(
        schoolIds.map((schoolId) => apiClient.post('/school-lists', { schoolId, tier: 'TARGET' }))
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

      // 自动生成时间线
      try {
        await apiClient.post('/timelines/generate', { schoolIds });
        queryClient.invalidateQueries({ queryKey: ['timelines'] });
        toast.success(t('batchAddSuccess', { count: successCount }), {
          description: t('timelineGenerated'),
          action: {
            label: t('viewTimeline'),
            onClick: () => router.push('timeline'),
          },
        });
      } catch {
        // 时间线生成失败不影响选校
        toast.success(t('batchAddSuccess', { count: successCount }));
      }
    },
    onError: () => {
      toast.error(t('addFailed'));
    },
  });

  const schools = schoolsData?.items || [];
  const total = schoolsData?.total || 0;

  // Sort schools based on weights
  const sortedSchools = useMemo(() => {
    if (!schools.length) return [];

    return [...schools].sort((a, b) => {
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
  }, [schools, weights]);

  // 选择学校的处理函数
  const toggleSchoolSelection = useCallback((school: School, checked: boolean) => {
    if (checked) {
      setSelectedSchools((prev) => [
        ...prev,
        {
          id: school.id,
          name: school.name,
          nameZh: school.nameZh,
          usNewsRank: school.usNewsRank,
        },
      ]);
    } else {
      setSelectedSchools((prev) => prev.filter((s) => s.id !== school.id));
    }
  }, []);

  const isSchoolSelected = useCallback(
    (schoolId: string) => {
      return selectedSchools.some((s) => s.id === schoolId);
    },
    [selectedSchools]
  );

  const handleBatchAdd = useCallback(
    (schoolIds: string[]) => {
      batchAddMutation.mutate(schoolIds);
    },
    [batchAddMutation]
  );

  const handleRemoveFromSelection = useCallback((schoolId: string) => {
    setSelectedSchools((prev) => prev.filter((s) => s.id !== schoolId));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSchools([]);
  }, []);

  const activeFilterCount =
    (filters.schoolType !== 'ALL' ? 1 : 0) + (filters.tuitionRange !== 'ALL' ? 1 : 0);

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={GraduationCap}
        color="violet"
      />

      {/* Filters Section */}
      <Card className="mb-6">
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

            {/* All Filters Popover */}
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

                  {/* School Type */}
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

                  {/* Tuition Range */}
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

                  {/* Reset Filters */}
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

            {/* Weight Sorting */}
            <Collapsible open={showWeights} onOpenChange={setShowWeights}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t('weightSort')}
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', showWeights && 'rotate-180')}
                  />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          {/* Weight Sliders */}
          <Collapsible open={showWeights}>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <SlidersHorizontal className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{t('weights.title')}</h4>
                    <p className="text-xs text-muted-foreground">{t('weights.description')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <WeightSliderItem
                    icon={Trophy}
                    iconBg="bg-amber-500/10"
                    iconColor="text-amber-500"
                    barColor="bg-amber-500"
                    label={t('weights.ranking')}
                    value={weights.ranking}
                    onChange={(v) => setWeights((prev) => ({ ...prev, ranking: v }))}
                  />

                  <WeightSliderItem
                    icon={Percent}
                    iconBg="bg-violet-500/10"
                    iconColor="text-violet-500"
                    barColor="bg-violet-500"
                    label={t('weights.acceptanceRate')}
                    description={t('weights.acceptanceRateDesc')}
                    value={weights.acceptanceRate}
                    onChange={(v) => setWeights((prev) => ({ ...prev, acceptanceRate: v }))}
                  />

                  <WeightSliderItem
                    icon={DollarSign}
                    iconBg="bg-blue-500/10"
                    iconColor="text-blue-500"
                    barColor="bg-blue-500"
                    label={t('weights.tuition')}
                    description={t('weights.tuitionDesc')}
                    value={weights.tuition}
                    onChange={(v) => setWeights((prev) => ({ ...prev, tuition: v }))}
                  />

                  <WeightSliderItem
                    icon={TrendingUp}
                    iconBg="bg-emerald-500/10"
                    iconColor="text-emerald-500"
                    barColor="bg-emerald-500"
                    label={t('weights.salary')}
                    value={weights.salary}
                    onChange={(v) => setWeights((prev) => ({ ...prev, salary: v }))}
                  />
                </div>

                <div className="mt-6 pt-4 border-t">
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => setShowWeights(false)}
                  >
                    <ChevronRight className="h-4 w-4" />
                    {t('weights.preview')}
                  </Button>
                </div>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Index Legend - 使用新组件 */}
      <IndexLegend className="mb-4" />

      {/* Results Count and Selection Info */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{t('resultsCount', { count: total })}</p>
        {selectedSchools.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            {t('selectedCount', { count: selectedSchools.length })}
          </Badge>
        )}
      </div>

      {/* Schools List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              type="error"
              title={t('loadError')}
              description={t('loadErrorDesc')}
              action={{ label: tc('retry'), onClick: () => refetch() }}
            />
          </CardContent>
        </Card>
      ) : sortedSchools.length > 0 ? (
        <div className="space-y-3">
          {sortedSchools.map((school, index) => {
            const isSelected = isSchoolSelected(school.id);
            const isAdded = addedSchools.has(school.id);

            return (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
              >
                <Card
                  className={cn(
                    'hover:shadow-md transition-all group',
                    isSelected && 'ring-2 ring-primary/50 bg-primary/5'
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      {/* Checkbox for batch selection */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleSchoolSelection(school, checked as boolean)
                        }
                        disabled={isAdded}
                        className="shrink-0"
                      />

                      {/* Rank Badge */}
                      <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary">
                        #{school.usNewsRank || '-'}
                      </div>

                      {/* School Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/schools/${school.id}`}>
                            <h3 className="font-semibold truncate hover:text-primary transition-colors">
                              {getSchoolName(school, locale)}
                            </h3>
                          </Link>
                          {school.isPrivate !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              {school.isPrivate ? t('private') : t('public')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {(school.city || school.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {[school.city, school.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          {school.tuition && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3.5 w-3.5" />
                              {format.number(school.tuition, 'currency')}
                            </span>
                          )}
                          {school.acceptanceRate && (
                            <span className="flex items-center gap-1">
                              {Number(school.acceptanceRate).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Index Icons - 使用新组件 */}
                      <IndexGroup
                        safetyGrade={school.nicheSafetyGrade}
                        lifeGrade={school.nicheLifeGrade}
                        foodGrade={school.nicheFoodGrade}
                        className="flex shrink-0"
                      />

                      {/* Add to List Button */}
                      <Button
                        variant={isAdded ? 'secondary' : 'outline'}
                        size="sm"
                        className="shrink-0"
                        onClick={() => addToListMutation.mutate(school.id)}
                        disabled={addToListMutation.isPending || isAdded}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            {t('added')}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            {t('addToList')}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              type="no-results"
              title={t('noResults')}
              description={t('noResultsDesc')}
              action={{
                label: t('resetFilters'),
                onClick: () => {
                  setSearch('');
                  setFilters({ schoolType: 'ALL', tuitionRange: 'ALL' });
                },
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Floating Add Button - 右下角常驻按钮 */}
      <FloatingAddButton
        selectedSchools={selectedSchools}
        onAdd={handleBatchAdd}
        onRemove={handleRemoveFromSelection}
        onClear={handleClearSelection}
        isAdding={batchAddMutation.isPending}
      />
    </PageContainer>
  );
}
