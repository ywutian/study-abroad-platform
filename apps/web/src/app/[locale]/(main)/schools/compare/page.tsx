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
import { useRouter } from '@/lib/i18n/navigation';
import { cn, getSchoolName, formatAcceptanceRate } from '@/lib/utils';
import { Scale, Plus, X, GraduationCap, ArrowLeft } from 'lucide-react';

import type { SchoolDetail } from '../[id]/_components/types';

// ── Types ────────────────────────────────────────────────────────────

type CompareDirection = 'lower' | 'higher';

interface CompareField {
  key: string;
  labelKey: string;
  getValue: (s: SchoolDetail) => string | number | null | undefined;
  format: (
    v: number | string | null | undefined,
    formatter: ReturnType<typeof useFormatter>
  ) => string;
  best: CompareDirection;
}

// ── Field definitions ────────────────────────────────────────────────

function buildFields(t: ReturnType<typeof useTranslations>): CompareField[] {
  const pct = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return `${(n * 100).toFixed(1)}%`;
  };

  const rawPct = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return `${n.toFixed(1)}%`;
  };

  const rank = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    return `#${_v}`;
  };

  const num = (_v: number | string | null | undefined, f: ReturnType<typeof useFormatter>) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return f.number(n, 'standard');
  };

  const currency = (_v: number | string | null | undefined, f: ReturnType<typeof useFormatter>) => {
    if (_v == null) return '-';
    const n = typeof _v === 'string' ? parseFloat(_v) : _v;
    if (Number.isNaN(n)) return '-';
    return f.number(n, 'currency');
  };

  const bool = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    return _v ? t('yes') : t('no');
  };

  const ratio = (_v: number | string | null | undefined) => {
    if (_v == null) return '-';
    return `${_v}:1`;
  };

  return [
    // Rankings
    {
      key: 'usNewsRank',
      labelKey: 'fields.usNewsRank',
      getValue: (s) => s.usNewsRank,
      format: rank,
      best: 'lower',
    },
    {
      key: 'qsRank',
      labelKey: 'fields.qsRank',
      getValue: (s) => s.qsRank,
      format: rank,
      best: 'lower',
    },
    // Admissions
    {
      key: 'acceptanceRate',
      labelKey: 'fields.acceptanceRate',
      getValue: (s) => s.acceptanceRate,
      format: (_v) => formatAcceptanceRate(_v as number | null),
      best: 'lower',
    },
    {
      key: 'intlAcceptanceRate',
      labelKey: 'fields.intlAcceptanceRate',
      getValue: (s) => s.intlAcceptanceRate,
      format: (_v) => formatAcceptanceRate(_v as number | null),
      best: 'lower',
    },
    {
      key: 'hasEarlyDecision',
      labelKey: 'fields.hasEarlyDecision',
      getValue: (s) => s.hasEarlyDecision as unknown as number,
      format: bool,
      best: 'higher',
    },
    {
      key: 'testOptional',
      labelKey: 'fields.testOptional',
      getValue: (s) => s.testOptional as unknown as number,
      format: bool,
      best: 'higher',
    },
    // Test Scores
    {
      key: 'satAvg',
      labelKey: 'fields.satAvg',
      getValue: (s) => s.satAvg,
      format: num,
      best: 'higher',
    },
    {
      key: 'satRange',
      labelKey: 'fields.satRange',
      getValue: (s) => (s.sat25 != null && s.sat75 != null ? `${s.sat25}-${s.sat75}` : null),
      format: (_v) => (_v == null ? '-' : String(_v)),
      best: 'higher',
    },
    {
      key: 'actAvg',
      labelKey: 'fields.actAvg',
      getValue: (s) => s.actAvg,
      format: num,
      best: 'higher',
    },
    {
      key: 'toeflMin',
      labelKey: 'fields.toeflMin',
      getValue: (s) => s.metadata?.requirements?.toeflMin,
      format: num,
      best: 'lower',
    },
    // Cost
    {
      key: 'tuition',
      labelKey: 'fields.tuition',
      getValue: (s) => s.tuition,
      format: currency,
      best: 'lower',
    },
    {
      key: 'averageNetPrice',
      labelKey: 'fields.averageNetPrice',
      getValue: (s) => s.averageNetPrice,
      format: currency,
      best: 'lower',
    },
    {
      key: 'averageAidPackage',
      labelKey: 'fields.averageAidPackage',
      getValue: (s) => s.averageAidPackage,
      format: currency,
      best: 'higher',
    },
    {
      key: 'percentNeedMet',
      labelKey: 'fields.percentNeedMet',
      getValue: (s) => s.percentNeedMet,
      format: rawPct,
      best: 'higher',
    },
    {
      key: 'needBlindInternational',
      labelKey: 'fields.needBlindInternational',
      getValue: (s) => s.needBlindInternational as unknown as number,
      format: bool,
      best: 'higher',
    },
    // Outcomes
    {
      key: 'avgSalary',
      labelKey: 'fields.avgSalary',
      getValue: (s) => s.avgSalary,
      format: currency,
      best: 'higher',
    },
    {
      key: 'graduationRate',
      labelKey: 'fields.graduationRate',
      getValue: (s) => s.graduationRate,
      format: pct,
      best: 'higher',
    },
    {
      key: 'retentionRate',
      labelKey: 'fields.retentionRate',
      getValue: (s) => s.retentionRate,
      format: pct,
      best: 'higher',
    },
    // Campus
    {
      key: 'studentCount',
      labelKey: 'fields.studentCount',
      getValue: (s) => s.studentCount,
      format: num,
      best: 'higher',
    },
    {
      key: 'studentFacultyRatio',
      labelKey: 'fields.studentFacultyRatio',
      getValue: (s) => s.studentFacultyRatio,
      format: ratio,
      best: 'lower',
    },
    {
      key: 'intlStudentPct',
      labelKey: 'fields.intlStudentPct',
      getValue: (s) => s.intlStudentPct,
      format: rawPct,
      best: 'higher',
    },
  ];
}

// Field grouping for category headers
const CATEGORY_FIELDS: Record<string, string[]> = {
  rankings: ['usNewsRank', 'qsRank'],
  admissions: ['acceptanceRate', 'intlAcceptanceRate', 'hasEarlyDecision', 'testOptional'],
  testScores: ['satAvg', 'satRange', 'actAvg', 'toeflMin'],
  cost: [
    'tuition',
    'averageNetPrice',
    'averageAidPackage',
    'percentNeedMet',
    'needBlindInternational',
  ],
  outcomes: ['avgSalary', 'graduationRate', 'retentionRate'],
  campus: ['studentCount', 'studentFacultyRatio', 'intlStudentPct'],
};

// ── Helpers ──────────────────────────────────────────────────────────

function getBestIndex(schools: SchoolDetail[], field: CompareField): number | null {
  const values = schools.map((s) => {
    const raw = field.getValue(s);
    if (raw == null) return null;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    if (typeof raw === 'string') {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? null : n;
    }
    return raw;
  });

  const validValues = values.filter((v): v is number => v != null);
  if (validValues.length < 2) return null;

  const target = field.best === 'lower' ? Math.min(...validValues) : Math.max(...validValues);
  const idx = values.indexOf(target);
  // Only highlight if not all values are equal
  const allSame = validValues.every((v) => v === validValues[0]);
  if (allSame) return null;
  return idx;
}

// ── Component ────────────────────────────────────────────────────────

const MAX_SCHOOLS = 3;

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
      queryFn: () => apiClient.get<SchoolDetail>(`/schools/${id}`),
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

  const renderCategoryRows = (categoryKey: string) => {
    const fieldKeys = CATEGORY_FIELDS[categoryKey];
    if (!fieldKeys) return null;
    const categoryFields = fields.filter((f) => fieldKeys.includes(f.key));

    return (
      <>
        {/* Category header row */}
        <tr>
          <td
            colSpan={schools.length + 1}
            className="bg-muted/50 px-4 py-2.5 text-sm font-semibold text-foreground border-t border-border"
          >
            {t(`categories.${categoryKey}`)}
          </td>
        </tr>
        {/* Field rows */}
        {categoryFields.map((field) => {
          const bestIdx = getBestIndex(schools, field);
          return (
            <tr key={field.key} className="border-t border-border">
              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                {t(field.labelKey)}
              </td>
              {schools.map((school, idx) => {
                const raw = field.getValue(school);
                const formatted = field.format(raw, format);
                const isBest = bestIdx === idx;
                return (
                  <td
                    key={school.id}
                    className={cn(
                      'px-4 py-3 text-sm text-center',
                      isBest ? 'text-primary font-bold' : 'text-foreground'
                    )}
                  >
                    {formatted}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </>
    );
  };

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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-[180px]">
                    {t('field')}
                  </th>
                  {schools.map((school) => (
                    <th
                      key={school.id}
                      className="px-4 py-3 text-center text-sm font-semibold text-foreground"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate max-w-[180px]">
                          {getSchoolName(school, locale)}
                        </span>
                        {school.usNewsRank && (
                          <span className="text-xs font-normal text-muted-foreground">
                            #{school.usNewsRank} US News
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{Object.keys(CATEGORY_FIELDS).map((cat) => renderCategoryRows(cat))}</tbody>
            </table>
          </div>
        </Card>
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
