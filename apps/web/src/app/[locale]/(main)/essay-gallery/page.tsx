'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search,
  FileText,
  X,
  ChevronRight,
  Trophy,
  CheckCircle2,
  Calendar,
  BookOpen,
  Eye,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api/client';
import { cn, getSchoolName } from '@/lib/utils';
import { EssayDetailPanel } from './EssayDetailPanel';
import { AdvancedEssayFilter, EssayFilters } from '@/components/features/essay-gallery';

interface GalleryEssay {
  id: string;
  year: number;
  result: string;
  essayType?: string;
  promptNumber?: number;
  prompt: string | null;
  preview: string | null;
  wordCount: number;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
  } | null;
  tags: string[];
  isVerified: boolean;
}

interface GalleryStats {
  total: number;
  admitted: number;
  top20: number;
  byType: Record<string, number>;
}

interface GalleryResponse {
  items: GalleryEssay[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: GalleryStats;
}

const YEARS = ['2026', '2025', '2024', '2023', '2022'];

// ESSAY_TYPES labels will be resolved via translation in the component
const ESSAY_TYPE_KEYS = [
  { value: 'ALL', key: 'all' },
  { value: 'COMMON_APP', key: 'commonApp' },
  { value: 'UC', key: 'uc' },
  { value: 'SUPPLEMENTAL', key: 'supplemental' },
  { value: 'WHY_SCHOOL', key: 'whySchool' },
];

const RESULT_STYLES: Record<string, string> = {
  ADMITTED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  WAITLISTED: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  DEFERRED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const TYPE_STYLES: Record<string, string> = {
  COMMON_APP: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  UC: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  SUPPLEMENTAL: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  WHY_SCHOOL: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  OTHER: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export default function EssayGalleryPage() {
  const t = useTranslations('essayGallery');
  const tc = useTranslations('cases');

  // 基础筛选状态
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedEssay, setSelectedEssay] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // 高级筛选状态
  const [advancedFilters, setAdvancedFilters] = useState<EssayFilters>({});

  // 计算激活的高级筛选数量
  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.type) count++;
    if (advancedFilters.promptNumber) count++;
    if (advancedFilters.result) count++;
    if (advancedFilters.rankMin || advancedFilters.rankMax) count++;
    if (advancedFilters.isVerified) count++;
    return count;
  }, [advancedFilters]);

  // 重置高级筛选
  const resetAdvancedFilters = () => {
    setAdvancedFilters({});
  };

  // 获取结果标签
  const getResultLabel = (result: string) => {
    const labels: Record<string, string> = {
      ADMITTED: tc('result.admitted'),
      REJECTED: tc('result.rejected'),
      WAITLISTED: tc('result.waitlisted'),
      DEFERRED: tc('result.deferred'),
    };
    return labels[result] || result;
  };

  // 获取文书类型标签
  const getTypeLabel = (type?: string) => {
    if (!type) return '';
    const typeKeyMap: Record<string, string> = {
      COMMON_APP: 'commonApp',
      UC: 'uc',
      SUPPLEMENTAL: 'supplemental',
      WHY_SCHOOL: 'whySchool',
      OTHER: 'other',
    };
    const key = typeKeyMap[type];
    return key ? t(`essayTypes.${key}`) : type;
  };

  // 构建查询参数
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      page: String(page),
      pageSize: '12',
    };
    if (search) params.school = search;
    if (yearFilter && yearFilter !== 'ALL') params.year = yearFilter;

    // 优先使用高级筛选的类型
    const effectiveType = advancedFilters.type || (typeFilter !== 'ALL' ? typeFilter : undefined);
    if (effectiveType) params.type = effectiveType;

    if (advancedFilters.promptNumber) params.promptNumber = String(advancedFilters.promptNumber);
    if (advancedFilters.result) params.result = advancedFilters.result;
    if (advancedFilters.rankMin) params.rankMin = String(advancedFilters.rankMin);
    if (advancedFilters.rankMax) params.rankMax = String(advancedFilters.rankMax);
    if (advancedFilters.isVerified) params.isVerified = 'true';

    return params;
  }, [search, yearFilter, typeFilter, advancedFilters, page]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['essay-gallery', queryParams],
    queryFn: () => apiClient.get<GalleryResponse>('/essay-ai/gallery', { params: queryParams }),
    staleTime: 5 * 60 * 1000,
  });

  const essays = data?.items || [];
  const stats = data?.stats || { total: 0, admitted: 0, top20: 0, byType: {} };
  const hasFilters =
    search || yearFilter !== 'ALL' || typeFilter !== 'ALL' || activeAdvancedFilterCount > 0;

  // 快捷标签点击
  const handleQuickTag = (tag: string) => {
    switch (tag) {
      case 'COMMON_APP':
      case 'UC':
      case 'SUPPLEMENTAL':
        setTypeFilter(typeFilter === tag ? 'ALL' : tag);
        break;
      case 'TOP20':
        setAdvancedFilters((prev) => ({
          ...prev,
          rankMin: prev.rankMax === 20 ? undefined : 1,
          rankMax: prev.rankMax === 20 ? undefined : 20,
        }));
        break;
      case 'VERIFIED':
        setAdvancedFilters((prev) => ({
          ...prev,
          isVerified: !prev.isVerified,
        }));
        break;
    }
    setPage(1);
  };

  return (
    <PageContainer maxWidth="7xl">
      {/* 页面头部 - 带装饰元素 */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-amber-500/5 p-6 sm:p-8">
        {/* 装饰背景 */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-title">{t('title')}</h1>
                <p className="text-muted-foreground">{t('description')}</p>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs">{t('stats.total')}</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">{t('stats.admitted')}</span>
              </div>
              <p className="text-2xl font-bold text-emerald-500">{stats.admitted}</p>
            </div>
            <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Trophy className="h-4 w-4" />
                <span className="text-xs">{t('stats.top20')}</span>
              </div>
              <p className="text-2xl font-bold text-amber-500">{stats.top20}</p>
            </div>
            <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">{t('stats.commonApp')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-500">{stats.byType?.COMMON_APP || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1 bg-amber-500" />
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-11"
              />
            </div>

            {/* 文书类型筛选 */}
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('essayTypeFilter')} />
              </SelectTrigger>
              <SelectContent>
                {ESSAY_TYPE_KEYS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`essayTypes.${type.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 年份筛选 */}
            <Select
              value={yearFilter}
              onValueChange={(v) => {
                setYearFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('yearFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('allYears')}</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 高级筛选 */}
            <AdvancedEssayFilter
              filters={advancedFilters}
              onChange={(f) => {
                setAdvancedFilters(f);
                setPage(1);
              }}
              onReset={resetAdvancedFilters}
              activeCount={activeAdvancedFilterCount}
            />
          </div>

          {/* 快捷标签 */}
          <div className="flex flex-wrap gap-2 mt-4">
            <QuickTag
              label="Common App"
              active={typeFilter === 'COMMON_APP'}
              onClick={() => handleQuickTag('COMMON_APP')}
              color="blue"
            />
            <QuickTag
              label={t('quickTags.uc')}
              active={typeFilter === 'UC'}
              onClick={() => handleQuickTag('UC')}
              color="amber"
            />
            <QuickTag
              label={t('quickTags.supplemental')}
              active={typeFilter === 'SUPPLEMENTAL'}
              onClick={() => handleQuickTag('SUPPLEMENTAL')}
              color="purple"
            />
            <QuickTag
              label={t('quickTags.top20')}
              active={advancedFilters.rankMax === 20}
              onClick={() => handleQuickTag('TOP20')}
              color="emerald"
              icon={Trophy}
            />
            <QuickTag
              label={t('quickTags.verified')}
              active={advancedFilters.isVerified === true}
              onClick={() => handleQuickTag('VERIFIED')}
              color="green"
              icon={CheckCircle2}
            />
          </div>

          {/* 已选筛选标签 */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
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
              {typeFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <FileText className="h-3 w-3" />
                  {getTypeLabel(typeFilter)}
                  <button
                    onClick={() => setTypeFilter('ALL')}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {yearFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Calendar className="h-3 w-3" />
                  {yearFilter}
                  <button
                    onClick={() => setYearFilter('ALL')}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {advancedFilters.result && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  {getResultLabel(advancedFilters.result)}
                  <button
                    onClick={() => setAdvancedFilters((p) => ({ ...p, result: undefined }))}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(advancedFilters.rankMin || advancedFilters.rankMax) && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Trophy className="h-3 w-3" />#{advancedFilters.rankMin || 1}-
                  {advancedFilters.rankMax || 100}
                  <button
                    onClick={() =>
                      setAdvancedFilters((p) => ({ ...p, rankMin: undefined, rankMax: undefined }))
                    }
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {advancedFilters.isVerified && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t('quickTags.verified')}
                  <button
                    onClick={() => setAdvancedFilters((p) => ({ ...p, isVerified: undefined }))}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 结果统计 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between mb-4"
      >
        <p className="text-sm text-muted-foreground">
          {t('resultsCount', { count: data?.total || 0 })}
        </p>
      </motion.div>

      {/* 文书列表 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-1 bg-amber-500/30" />
              <CardContent className="pt-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-20 w-full mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
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
              action={{
                label: t('retry'),
                onClick: () => refetch(),
              }}
              size="lg"
            />
          </CardContent>
        </Card>
      ) : essays.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {essays.map((essay, index) => (
              <EssayCard
                key={essay.id}
                essay={essay}
                index={index}
                onClick={() => setSelectedEssay(essay.id)}
                getResultLabel={getResultLabel}
                getTypeLabel={getTypeLabel}
                t={t}
              />
            ))}
          </div>

          {/* 分页 */}
          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t('prevPage')}
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                {t('nextPage')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-amber-500/50" />
          <CardContent className="py-8">
            {hasFilters ? (
              <EmptyState
                type="no-results"
                title={t('noResults')}
                description={t('noResultsDesc')}
                action={{
                  label: t('clearFilters'),
                  onClick: () => {
                    setSearch('');
                    setYearFilter('ALL');
                    setTypeFilter('ALL');
                    resetAdvancedFilters();
                  },
                  variant: 'outline',
                  icon: <X className="h-4 w-4" />,
                }}
                size="lg"
              />
            ) : (
              <EmptyState
                type="essays"
                title={t('noPublicEssays')}
                description={t('noPublicEssaysDesc')}
                size="lg"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 文书详情弹窗 */}
      <Dialog open={!!selectedEssay} onOpenChange={() => setSelectedEssay(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedEssay && (
            <EssayDetailPanel essayId={selectedEssay} onClose={() => setSelectedEssay(null)} />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// 快捷标签组件
function QuickTag({
  label,
  active,
  onClick,
  color = 'gray',
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: 'blue' | 'amber' | 'purple' | 'emerald' | 'green' | 'gray';
  icon?: any;
}) {
  const colorClasses = {
    blue: active ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' : 'hover:bg-blue-500/5',
    amber: active ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'hover:bg-amber-500/5',
    purple: active
      ? 'bg-purple-500/10 text-purple-600 border-purple-500/30'
      : 'hover:bg-purple-500/5',
    emerald: active
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
      : 'hover:bg-emerald-500/5',
    green: active ? 'bg-green-500/10 text-green-600 border-green-500/30' : 'hover:bg-green-500/5',
    gray: active ? 'bg-gray-500/10 text-gray-600 border-gray-500/30' : 'hover:bg-gray-500/5',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
        colorClasses[color]
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

// 文书卡片组件
function EssayCard({
  essay,
  index,
  onClick,
  getResultLabel,
  getTypeLabel,
  t,
}: {
  essay: GalleryEssay;
  index: number;
  onClick: () => void;
  getResultLabel: (result: string) => string;
  getTypeLabel: (type?: string) => string;
  t: any;
}) {
  const locale = useLocale();
  const resultStyle = RESULT_STYLES[essay.result] || RESULT_STYLES.ADMITTED;
  const typeStyle = essay.essayType ? TYPE_STYLES[essay.essayType] || TYPE_STYLES.OTHER : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card
        className="h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer group overflow-hidden"
        onClick={onClick}
      >
        {/* 顶部装饰条 */}
        <div className="h-1 bg-amber-500 group-hover:h-1.5 transition-all" />

        <CardContent className="pt-4">
          {/* 学校信息 + 录取结果 */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {essay.school?.usNewsRank && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-0.5 bg-amber-500 text-white border-0"
                >
                  <Trophy className="h-3 w-3" />#{essay.school.usNewsRank}
                </Badge>
              )}
              <span className="font-semibold truncate">
                {getSchoolName(essay.school, locale) || t('unknownSchool')}
              </span>
            </div>
            <Badge className={cn('shrink-0', resultStyle)}>{getResultLabel(essay.result)}</Badge>
          </div>

          {/* 文书类型和题号 */}
          {essay.essayType && (
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className={cn('text-xs', typeStyle)}>
                {getTypeLabel(essay.essayType)}
                {essay.promptNumber && ` #${essay.promptNumber}`}
              </Badge>
              <span className="text-xs text-muted-foreground">{essay.year}</span>
            </div>
          )}

          {/* 题目 */}
          {essay.prompt && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{essay.prompt}</p>
          )}

          {/* 预览 */}
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <p className="text-sm line-clamp-3 italic text-muted-foreground">"{essay.preview}"</p>
          </div>

          {/* 元信息 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {t('wordCount', { count: essay.wordCount })}
              </span>
              {!essay.essayType && <span>{essay.year}</span>}
            </div>
            <div className="flex items-center gap-2">
              {essay.isVerified && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs bg-emerald-500/10 text-emerald-600"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {t('detail.verified')}
                </Badge>
              )}
            </div>
          </div>

          {/* 查看详情 */}
          <div className="mt-3 flex items-center justify-end text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="h-4 w-4 mr-1" />
            {t('readMore')}
            <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
