'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SchoolSelector } from '@/components/features/school-selector';
import { apiClient, STALE_TIME } from '@/lib/api';
import { schoolRoutes } from '@study-abroad/shared';
import { useRouter } from '@/lib/i18n/navigation';
import { getSchoolName } from '@/lib/utils';
import { Scale, Plus, X, GraduationCap, ArrowLeft } from 'lucide-react';

import type { SchoolDetail } from '../[id]/_components/types';
import { buildFields } from './_components/compare-fields';
import { MAX_SCHOOLS } from './_components/compare-utils';
import { CompareTable } from './_components/compare-table';

export default function SchoolComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('schoolCompare');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();

  const [selectorOpen, setSelectorOpen] = useState(false);

  // Read IDs from query params
  const initialIds = useMemo(() => {
    const raw = searchParams.get('ids');
    if (!raw) return [];
    return raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_SCHOOLS);
  }, [searchParams]);

  const [schoolIds, setSchoolIds] = useState<string[]>(initialIds);

  // Fetch all schools in parallel
  const schoolQueries = useQueries({
    queries: schoolIds.map((id) => ({
      queryKey: ['school', id],
      queryFn: () => apiClient.get<SchoolDetail>(schoolRoutes.byId(id)),
      staleTime: STALE_TIME.STATIC,
      enabled: !!id,
    })),
  });

  const schools = useMemo(
    () => schoolQueries.map((q) => q.data).filter((s): s is SchoolDetail => s != null),
    [schoolQueries]
  );

  const isLoading = schoolQueries.some((q) => q.isLoading);

  const fields = useMemo(() => buildFields(t), [t]);

  // Update URL with school IDs
  const updateUrl = useCallback(
    (ids: string[]) => {
      const params = new URLSearchParams();
      if (ids.length > 0) {
        params.set('ids', ids.join(','));
      }
      router.replace(`/schools/compare?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const handleRemoveSchool = useCallback(
    (id: string) => {
      const newIds = schoolIds.filter((sid) => sid !== id);
      setSchoolIds(newIds);
      updateUrl(newIds);
    },
    [schoolIds, updateUrl]
  );

  const handleSelectSchools = useCallback(
    (
      selected: Array<{
        id: string;
        name: string;
        nameZh?: string;
        country: string;
        state?: string;
        usNewsRank?: number;
        acceptanceRate?: number;
      }>
    ) => {
      const newIds = selected.map((s) => s.id).slice(0, MAX_SCHOOLS);
      setSchoolIds(newIds);
      updateUrl(newIds);
      setSelectorOpen(false);
    },
    [updateUrl]
  );

  // Build selected schools for the selector (using fetched data)
  const selectedForSelector = useMemo(
    () =>
      schools.map((s) => ({
        id: s.id,
        name: s.name,
        nameZh: s.nameZh,
        country: s.country,
        state: s.state,
        usNewsRank: s.usNewsRank,
        acceptanceRate: s.acceptanceRate,
      })),
    [schools]
  );

  return (
    <PageContainer maxWidth="default">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Button>

      <PageHeader title={t('title')} description={t('description')} icon={Scale} color="blue" />

      {/* School selector bar */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        {schoolIds.map((id) => {
          const school = schools.find((s) => s.id === id);
          return (
            <Card key={id} className="flex items-center gap-2 px-3 py-2">
              {school ? (
                <span className="text-sm font-medium min-w-0 truncate max-w-[200px]">
                  {getSchoolName(school, locale)}
                </span>
              ) : (
                <Skeleton className="h-4 w-24" />
              )}
              <button
                onClick={() => handleRemoveSchool(id)}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t('removeSchool')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Card>
          );
        })}
        {schoolIds.length < MAX_SCHOOLS && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectorOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {t('addSchool')}
          </Button>
        )}
        {schoolIds.length >= MAX_SCHOOLS && (
          <span className="text-xs text-muted-foreground">
            {t('maxSchools', { max: MAX_SCHOOLS })}
          </span>
        )}
      </div>

      {/* Empty state */}
      {schoolIds.length === 0 && (
        <EmptyState
          icon={<GraduationCap className="h-12 w-12" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={{
            label: t('addSchool'),
            onClick: () => setSelectorOpen(true),
          }}
        />
      )}

      {/* Loading state */}
      {isLoading && schoolIds.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-32 shrink-0" />
                {schoolIds.map((id) => (
                  <Skeleton key={id} className="h-5 flex-1" />
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Comparison table */}
      {!isLoading && schools.length >= 2 && (
        <CompareTable schools={schools} fields={fields} locale={locale} format={format} t={t} />
      )}

      {/* Single school - prompt to add more */}
      {!isLoading && schools.length === 1 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">{t('addMoreToCompare')}</p>
            <Button variant="outline" onClick={() => setSelectorOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('addSchool')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* School selector dialog */}
      <SchoolSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        selectedSchools={selectedForSelector}
        onSelect={handleSelectSchools}
        maxSelection={MAX_SCHOOLS}
        title={t('selectSchoolsTitle')}
      />
    </PageContainer>
  );
}
