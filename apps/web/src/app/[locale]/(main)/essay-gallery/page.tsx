'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, FileText, X, Trophy, CheckCircle2, BookOpen } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { apiClient } from '@/lib/api/client';
import { cn, getSchoolName } from '@/lib/utils';
import { EssayDetailPanel } from './EssayDetailPanel';
import { AdvancedEssayFilter, EssayFilters } from '@/components/features/essay-gallery';
import { SubmitCaseDialog } from '@/components/features';
import {
  getResultBarColor,
  getResultBadgeClass,
  getResultLabel as getResultLabelUtil,
  getEssayTypeLabel as getEssayTypeLabelUtil,
  getEssayTypeBadgeClass,
  VERIFIED_BADGE_CLASS,
} from '@/lib/utils/admission';

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

const ESSAY_TYPE_KEYS = [
  { value: 'ALL', key: 'all' },
  { value: 'COMMON_APP', key: 'commonApp' },
  { value: 'UC', key: 'uc' },
  { value: 'SUPPLEMENTAL', key: 'supplemental' },
  { value: 'WHY_SCHOOL', key: 'whySchool' },
];

export default function EssayGalleryPage() {
  const t = useTranslations('essayGallery');
  const tc = useTranslations('cases');
  const locale = useLocale();

  // ── 筛选状态 ──
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [selectedEssay, setSelectedEssay] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // 检测是否桌面端（lg breakpoint = 1024px）
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 高级筛选（移动端 fallback）
  const [advancedFilters, setAdvancedFilters] = useState<EssayFilters>({});

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.type) count++;
    if (advancedFilters.promptNumber) count++;
    if (advancedFilters.result) count++;
    if (advancedFilters.rankMin || advancedFilters.rankMax) count++;
    if (advancedFilters.isVerified) count++;
    return count;
  }, [advancedFilters]);

  const resetAdvancedFilters = () => setAdvancedFilters({});

  // ── 翻译辅助 ──
  const getResultLabel = useCallback(
    (result: string) => getResultLabelUtil(result, (key: string) => tc(key)),
    [tc]
  );
  const getTypeLabel = useCallback(
    (type?: string) => getEssayTypeLabelUtil(type, (key: string) => t(key)),
    [t]
  );

  // ── 构建查询参数 ──
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      page: String(page),
      pageSize: '20',
    };
    if (search) params.school = search;
    if (yearFilter && yearFilter !== 'ALL') params.year = yearFilter;

    const effectiveType = advancedFilters.type || (typeFilter !== 'ALL' ? typeFilter : undefined);
    if (effectiveType) params.type = effectiveType;

    const effectiveResult =
      advancedFilters.result || (resultFilter !== 'ALL' ? resultFilter : undefined);
    if (effectiveResult) params.result = effectiveResult;

    if (advancedFilters.promptNumber) params.promptNumber = String(advancedFilters.promptNumber);
    if (advancedFilters.rankMin) params.rankMin = String(advancedFilters.rankMin);
    if (advancedFilters.rankMax) params.rankMax = String(advancedFilters.rankMax);
    if (advancedFilters.isVerified) params.isVerified = 'true';

    return params;
  }, [search, yearFilter, typeFilter, resultFilter, advancedFilters, page]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['essay-gallery', queryParams],
    queryFn: () => apiClient.get<GalleryResponse>('/essay-ai/gallery', { params: queryParams }),
    staleTime: 5 * 60 * 1000,
  });

  const essays = data?.items || [];
  const stats = data?.stats || { total: 0, admitted: 0, top20: 0, byType: {} };
  const hasFilters =
    search ||
    yearFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    resultFilter !== 'ALL' ||
    activeAdvancedFilterCount > 0;

  const clearAll = () => {
    setSearch('');
    setYearFilter('ALL');
    setTypeFilter('ALL');
    setResultFilter('ALL');
    resetAdvancedFilters();
    setPage(1);
  };

  return (
    <PageContainer maxWidth="fluid">
      {/* ══════════════ 紧凑标题栏 ══════════════ */}
      <div className="flex items-center gap-4 lg:gap-6 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-title text-lg font-bold">{t('title')}</h1>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <AnimatedCounter value={stats.total} className="font-semibold text-foreground" />{' '}
            {t('resultsCount', { count: '' }).replace(/\d*/, '').trim()}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            <AnimatedCounter value={stats.admitted} className="font-semibold" />{' '}
            {tc('result.admitted')}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            <AnimatedCounter value={stats.top20} className="font-semibold" /> Top 20
          </span>
        </div>
        <Button onClick={() => setSubmitDialogOpen(true)} size="sm" className="ml-auto shrink-0">
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          {t('shareYourEssay')}
        </Button>
      </div>

      {/* ══════════════ 统一筛选栏 ══════════════ */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* 文书类型 */}
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px] h-9 text-sm">
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

        {/* 年份 */}
        <Select
          value={yearFilter}
          onValueChange={(v) => {
            setYearFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[110px] h-9 text-sm">
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

        {/* 录取结果 */}
        <Select
          value={resultFilter}
          onValueChange={(v) => {
            setResultFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder={tc('filters.result') || 'Result'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tc('filters.allResults') || 'All'}</SelectItem>
            <SelectItem value="ADMITTED">{tc('result.admitted')}</SelectItem>
            <SelectItem value="REJECTED">{tc('result.rejected')}</SelectItem>
            <SelectItem value="WAITLISTED">{tc('result.waitlisted')}</SelectItem>
            <SelectItem value="DEFERRED">{tc('result.deferred')}</SelectItem>
          </SelectContent>
        </Select>

        {/* 高级筛选（移动端和补充筛选） */}
        <AdvancedEssayFilter
          filters={advancedFilters}
          onChange={(f) => {
            setAdvancedFilters(f);
            setPage(1);
          }}
          onReset={resetAdvancedFilters}
          activeCount={activeAdvancedFilterCount}
        />

        {/* 清除所有 */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-9 px-2">
            <X className="h-3.5 w-3.5 mr-1" />
            {t('clearFilters')}
          </Button>
        )}
      </div>

      {/* ══════════════ 主体区域：Master-Detail ══════════════ */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <Card className="overflow-hidden">
          <div className="h-1 bg-destructive" />
          <CardContent className="py-8">
            <EmptyState
              type="error"
              title={t('loadError')}
              description={t('loadErrorDesc')}
              action={{ label: t('retry'), onClick: () => refetch() }}
              size="lg"
            />
          </CardContent>
        </Card>
      ) : essays.length > 0 ? (
        <>
          {/* ── 桌面端：左列表 + 右详情 ── */}
          <div className="hidden lg:flex border rounded-xl overflow-hidden bg-card h-[calc(100dvh-200px)]">
            {/* 左栏：文书列表 */}
            <div className="w-[420px] shrink-0 border-r flex flex-col">
              <div className="shrink-0 px-4 py-2.5 border-b bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {t('resultsCount', { count: data?.total || 0 })}
                </p>
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {essays.map((essay) => (
                    <EssayListItem
                      key={essay.id}
                      essay={essay}
                      isActive={selectedEssay === essay.id}
                      onClick={() => setSelectedEssay(essay.id)}
                      getResultLabel={getResultLabel}
                      getTypeLabel={getTypeLabel}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </div>
              </ScrollArea>
              {/* 分页 */}
              {data && data.totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-center gap-2 py-2.5 border-t bg-muted/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-7 text-xs"
                  >
                    {t('prevPage')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="h-7 text-xs"
                  >
                    {t('nextPage')}
                  </Button>
                </div>
              )}
            </div>

            {/* 右栏：详情面板 */}
            <div className="flex-1 min-w-0">
              {selectedEssay ? (
                <EssayDetailPanel essayId={selectedEssay} onClose={() => setSelectedEssay(null)} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground mb-1">{t('viewDetail')}</p>
                  <p className="text-sm text-muted-foreground/70">{t('description')}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 移动端：卡片网格 + Sheet ── */}
          <div className="lg:hidden">
            <p className="text-sm text-muted-foreground mb-3">
              {t('resultsCount', { count: data?.total || 0 })}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {essays.map((essay, index) => (
                <MobileEssayCard
                  key={essay.id}
                  essay={essay}
                  index={index}
                  onClick={() => setSelectedEssay(essay.id)}
                  getResultLabel={getResultLabel}
                  getTypeLabel={getTypeLabel}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>

            {/* 移动端分页 */}
            {data && data.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
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

            {/* 移动端 Sheet 详情（仅非桌面端渲染，避免 portal 穿透） */}
            {!isDesktop && (
              <Sheet open={!!selectedEssay} onOpenChange={() => setSelectedEssay(null)}>
                <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-hidden">
                  <SheetTitle className="sr-only">{t('viewDetail')}</SheetTitle>
                  {selectedEssay && (
                    <EssayDetailPanel
                      essayId={selectedEssay}
                      onClose={() => setSelectedEssay(null)}
                    />
                  )}
                </SheetContent>
              </Sheet>
            )}
          </div>
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
                  onClick: clearAll,
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

      {/* 投稿对话框 */}
      <SubmitCaseDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        defaultIncludeEssay
      />
    </PageContainer>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 桌面端列表项 (~72px)
// ══════════════════════════════════════════════════════════════════════════════

function EssayListItem({
  essay,
  isActive,
  onClick,
  getResultLabel,
  getTypeLabel,
  locale,
  t,
}: {
  essay: GalleryEssay;
  isActive: boolean;
  onClick: () => void;
  getResultLabel: (result: string) => string;
  getTypeLabel: (type?: string) => string;
  locale: string;
  t: any;
}) {
  const barColor = getResultBarColor(essay.result);
  const resultBadgeClass = getResultBadgeClass(essay.result);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-muted/50',
        isActive && 'bg-primary/5 border-l-[3px] border-l-primary'
      )}
    >
      {/* 左侧颜色指示条（非 active 时） */}
      {!isActive && <div className={cn('w-[3px] shrink-0 rounded-full self-stretch', barColor)} />}

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {/* 第一行：学校名 + 排名 + 结果 */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-sm truncate">
              {getSchoolName(essay.school, locale) || t('unknownSchool')}
            </span>
            {essay.school?.usNewsRank && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                #{essay.school.usNewsRank}
              </span>
            )}
          </div>
          <Badge className={cn('shrink-0 text-[10px] px-1.5 py-0', resultBadgeClass)}>
            {getResultLabel(essay.result)}
          </Badge>
        </div>

        {/* 第二行：类型 · 年份 */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {essay.essayType && (
            <>
              <span>{getTypeLabel(essay.essayType)}</span>
              {essay.promptNumber && <span>#{essay.promptNumber}</span>}
              <span>·</span>
            </>
          )}
          <span>{essay.year}</span>
          {essay.isVerified && (
            <>
              <span>·</span>
              <CheckCircle2 className="h-3 w-3 text-sky-500" />
            </>
          )}
        </div>

        {/* 第三行：预览 + 词数 */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground/70 truncate">
            {essay.preview || essay.prompt || ''}
          </p>
          <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
            {essay.wordCount}w
          </span>
        </div>
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 移动端卡片（简化版）
// ══════════════════════════════════════════════════════════════════════════════

function MobileEssayCard({
  essay,
  index,
  onClick,
  getResultLabel,
  getTypeLabel,
  locale,
  t,
}: {
  essay: GalleryEssay;
  index: number;
  onClick: () => void;
  getResultLabel: (result: string) => string;
  getTypeLabel: (type?: string) => string;
  locale: string;
  t: any;
}) {
  const barColor = getResultBarColor(essay.result);
  const resultBadgeClass = getResultBadgeClass(essay.result);
  const typeBadgeClass = essay.essayType ? getEssayTypeBadgeClass(essay.essayType) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.32) }}
    >
      <Card
        className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
        onClick={onClick}
      >
        <div className={cn('h-1', barColor)} />
        <CardContent className="pt-3 pb-3">
          {/* 学校 + 结果 */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {getSchoolName(essay.school, locale) || t('unknownSchool')}
              </h3>
              {essay.school?.usNewsRank && (
                <Badge
                  variant="outline"
                  className="shrink-0 gap-0.5 text-[10px] h-5 bg-amber-500/10 text-amber-600 border-amber-500/20"
                >
                  <Trophy className="h-3 w-3" />#{essay.school.usNewsRank}
                </Badge>
              )}
            </div>
            <Badge className={cn('shrink-0 text-[11px]', resultBadgeClass)}>
              {getResultLabel(essay.result)}
            </Badge>
          </div>

          {/* 类型 + 年份 */}
          <div className="flex items-center gap-1.5 mb-2">
            {essay.essayType && (
              <Badge variant="outline" className={cn('text-[10px] h-5', typeBadgeClass)}>
                {getTypeLabel(essay.essayType)}
                {essay.promptNumber && ` #${essay.promptNumber}`}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{essay.year}</span>
          </div>

          {/* 预览 */}
          {essay.preview && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
              {essay.preview}
            </p>
          )}

          {/* 底部：词数 + 认证 */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {t('wordCount', { count: essay.wordCount })}
            </span>
            {essay.isVerified && (
              <Badge
                variant="secondary"
                className={cn('gap-0.5 text-[10px] px-1.5 py-0', VERIFIED_BADGE_CLASS)}
              >
                <CheckCircle2 className="h-3 w-3" />
                {t('detail.verified')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 加载骨架屏
// ══════════════════════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <>
      {/* 桌面端骨架 */}
      <div className="hidden lg:flex border rounded-xl overflow-hidden bg-card h-[calc(100dvh-200px)]">
        <div className="w-[420px] shrink-0 border-r">
          <div className="px-4 py-2.5 border-b">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>

      {/* 移动端骨架 */}
      <div className="lg:hidden grid gap-4 sm:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-1 bg-muted animate-pulse" />
            <CardContent className="pt-3 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
