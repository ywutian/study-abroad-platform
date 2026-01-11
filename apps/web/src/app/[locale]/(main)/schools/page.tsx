'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  MapPin,
  Trophy,
  GraduationCap,
  Building2,
  Globe,
  ChevronRight,
  SlidersHorizontal,
  X,
  Users,
  DollarSign,
  Award,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

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
}

const countries = [
  { value: 'ALL', labelKey: 'all' },
  { value: 'US', labelKey: 'us' },
  { value: 'UK', labelKey: 'uk' },
  { value: 'CA', labelKey: 'canada' },
  { value: 'AU', labelKey: 'australia' },
  { value: 'DE', labelKey: 'germany' },
  { value: 'JP', labelKey: 'japan' },
];

// 根据排名返回不同的徽章样式
const getRankBadgeStyle = (rank: number) => {
  if (rank <= 10) return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white';
  if (rank <= 30) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  if (rank <= 50) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  return 'bg-muted text-muted-foreground';
};

export default function SchoolsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('ALL');
  const [sortBy, setSortBy] = useState('rank');

  const { data: schoolsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['schools', search, country],
    queryFn: () => {
      const params: Record<string, string> = { pageSize: '50' };
      if (search) params.search = search;
      if (country && country !== 'ALL') params.country = country;
      return apiClient.get<{ items: School[]; total: number }>('/schools', { params });
    },
    retry: 2,
  });

  const schools = schoolsData?.items || [];
  const total = schoolsData?.total || 0;
  const hasFilters = search || country !== 'ALL';

  const sortedSchools = useMemo(() => {
    const sorted = [...schools];
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
  }, [schools, sortBy]);

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('schools.title')}
        description={t('schools.description')}
        icon={GraduationCap}
        color="violet"
      />

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="mb-6 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('schools.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Country Filter */}
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={t('schools.country')} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {t(`schools.countries.${c.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={t('schools.sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rank">{t('schools.sort.rank')}</SelectItem>
                  <SelectItem value="name">{t('schools.sort.name')}</SelectItem>
                  <SelectItem value="acceptance">{t('schools.sort.acceptance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters */}
            {(search || country !== 'ALL') && (
              <div className="flex flex-wrap gap-2 mt-4">
                {search && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    <Search className="h-3 w-3" />
                    {search}
                    <button onClick={() => setSearch('')} className="ml-1 rounded-full hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {country !== 'ALL' && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    <Globe className="h-3 w-3" />
                    {t(`schools.countries.${countries.find(c => c.value === country)?.labelKey}`)}
                    <button onClick={() => setCountry('ALL')} className="ml-1 rounded-full hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Count */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between mb-4"
      >
        <p className="text-sm text-muted-foreground">
          {t('schools.resultsCount', { count: total })}
        </p>
      </motion.div>

      {/* Schools Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-1 bg-gradient-to-r from-violet-500/30 to-purple-500/30" />
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />
            <CardContent className="py-8">
              <EmptyState
                type="error"
                title={t('ui.empty.loadFailed')}
                description={t('ui.empty.loadFailedDesc')}
                action={{
                  label: t('ui.empty.retryLoad'),
                  onClick: () => refetch(),
                }}
                size="lg"
              />
            </CardContent>
          </Card>
        </motion.div>
      ) : sortedSchools.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedSchools.map((school, index) => (
            <motion.div
              key={school.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
            >
              <Link href={`/schools/${school.id}`}>
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer group overflow-hidden">
                  {/* 顶部装饰条 */}
                  <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 group-hover:h-1.5 transition-all" />
                  
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3 mb-3">
                      {/* 学校首字母图标 */}
                      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center border border-violet-500/20 group-hover:border-violet-500/40 group-hover:scale-105 transition-all">
                        <span className="text-lg font-bold bg-gradient-to-br from-violet-600 to-purple-600 bg-clip-text text-transparent">
                          {(school.nameZh || school.name).charAt(0)}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                            {school.nameZh || school.name}
                          </h3>
                          {school.usNewsRank && (
                            <Badge className={cn('shrink-0 gap-0.5', getRankBadgeStyle(school.usNewsRank))}>
                              <Trophy className="h-3 w-3" />
                              #{school.usNewsRank}
                            </Badge>
                          )}
                        </div>
                        {school.nameZh && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{school.name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span className="truncate">
                        {school.city && `${school.city}, `}
                        {school.state && `${school.state}, `}
                        {school.country}
                      </span>
                    </div>

                    {/* 数据指标 */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/50 group-hover:bg-muted/70 transition-colors">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                          <Award className="h-3 w-3" />
                          {t('schools.acceptanceRate')}
                        </div>
                        <div className={cn(
                          'font-semibold text-sm',
                          school.acceptanceRate && school.acceptanceRate < 15 ? 'text-rose-500' :
                          school.acceptanceRate && school.acceptanceRate < 30 ? 'text-amber-500' : ''
                        )}>
                          {school.acceptanceRate !== undefined && school.acceptanceRate !== null && typeof school.acceptanceRate === 'number'
                            ? `${school.acceptanceRate.toFixed(1)}%`
                            : '-'
                          }
                        </div>
                      </div>
                      <div className="text-center border-l border-border">
                        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                          <Users className="h-3 w-3" />
                          {t('schools.students')}
                        </div>
                        <div className="font-semibold text-sm">
                          {school.studentCount ? school.studentCount.toLocaleString() : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('schools.viewDetails')}
                      <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500/50 to-purple-500/50" />
            <CardContent className="py-8">
              {hasFilters ? (
                <EmptyState
                  type="no-results"
                  title={t('schools.noResults')}
                  description={t('schools.tryDifferentSearch')}
                  action={{
                    label: t('ui.empty.clearFilter'),
                    onClick: () => {
                      setSearch('');
                      setCountry('ALL');
                    },
                    variant: 'outline',
                    icon: <X className="h-4 w-4" />,
                  }}
                  size="lg"
                />
              ) : (
                <EmptyState
                  type="schools"
                  title={t('ui.empty.noSchools')}
                  description={t('ui.empty.noSchoolsDesc')}
                  action={{
                    label: t('ui.empty.browseAll'),
                    onClick: () => refetch(),
                    icon: <GraduationCap className="h-4 w-4" />,
                  }}
                  size="lg"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </PageContainer>
  );
}
