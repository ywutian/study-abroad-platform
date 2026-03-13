'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, X, BookOpen } from 'lucide-react';

import { PageContainer } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api/client';
import { AdvancedEssayFilter, EssayFilters } from '@/components/features/essay-gallery';
import { SubmitCaseDialog } from '@/components/features';
import {
  getResultLabel as getResultLabelUtil,
  getEssayTypeLabel as getEssayTypeLabelUtil,
} from '@/lib/utils/admission';

import { EssayCard, type GalleryEssay } from './_components/essay-card';
import { LoadingSkeleton } from './_components/loading-skeleton';

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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Backward-compatible redirect: ?id=xxx -> /essay-gallery/[id]
  useEffect(() => {
    const deepLinkId = searchParams.get('id');
    if (deepLinkId) router.replace(`/essay-gallery/${deepLinkId}`);
  }, [searchParams, router]);

  // ── Filter state ──
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Advanced filters
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

  // ── Translation helpers ──
  const getResultLabel = useCallback(
    (result: string) => getResultLabelUtil(result, (key: string) => tc(key)),
    [tc]
  );
  const getTypeLabel = useCallback(
    (type?: string) => getEssayTypeLabelUtil(type, (key: string) => t(key)),
    [t]
  );

  // ── Build query params ──
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
      {/* ══════════════ Header bar ══════════════ */}
      <div className="shrink-0 flex items-center gap-4 lg:gap-6 mb-4 flex-wrap">
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

      {/* ══════════════ Filter bar ══════════════ */}
      <div className="shrink-0 flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
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

        {/* Essay type */}
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

        {/* Year */}
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

        {/* Result */}
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

        {/* Advanced filters */}
        <AdvancedEssayFilter
          filters={advancedFilters}
          onChange={(f) => {
            setAdvancedFilters(f);
            setPage(1);
          }}
          onReset={resetAdvancedFilters}
          activeCount={activeAdvancedFilterCount}
        />

        {/* Clear all */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-9 px-2">
            <X className="h-3.5 w-3.5 mr-1" />
            {t('clearFilters')}
          </Button>
        )}
      </div>

      {/* ══════════════ Main content: card grid ══════════════ */}
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
          <p className="text-sm text-muted-foreground mb-3">
            {t('resultsCount', { count: data?.total || 0 })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {essays.map((essay, index) => (
              <EssayCard
                key={essay.id}
                essay={essay}
                index={index}
                onClick={() => router.push(`/essay-gallery/${essay.id}`)}
                getResultLabel={getResultLabel}
                getTypeLabel={getTypeLabel}
                locale={locale}
                t={t}
              />
            ))}
          </div>

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

      {/* Submit dialog */}
      <SubmitCaseDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        defaultIncludeEssay
      />
    </PageContainer>
  );
}
