'use client';

import { useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { LayoutGrid, List, SlidersHorizontal, Trophy, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  SCHOOL_DEFAULT_RANKING_LIST,
  type SchoolFilters,
  type SchoolRankingList,
  type SchoolSortBy,
} from '@/components/features/schools/school-filters';

export type SchoolViewMode = 'card' | 'list';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface RankingListOption {
  source: 'US_NEWS';
  list: SchoolRankingList;
  labelKey: string;
  year: number | null;
  count: number;
  verifiedCount?: number;
  fallbackCount?: number;
  isDefault: boolean;
}

interface SchoolToolbarProps {
  total: number;
  page: number;
  pageSize: number;
  sortBy: SchoolSortBy;
  onSortByChange: (value: SchoolSortBy) => void;
  rankingList: SchoolRankingList;
  rankingListOptions?: RankingListOption[];
  onRankingListChange: (value: SchoolRankingList) => void;
  viewMode: SchoolViewMode;
  onViewModeChange: (mode: SchoolViewMode) => void;
  search: string;
  onClearSearch: () => void;
  country: string;
  showCountryChip: boolean;
  countryLabel: string;
  onClearCountry: () => void;
  advancedFilters: SchoolFilters;
  onAdvancedFiltersChange: (filters: SchoolFilters) => void;
  onResetAll: () => void;
}

const CAMPUS_GRADE_LABELS: Record<string, string> = {
  A_PLUS: 'A+',
  A: 'A',
  A_MINUS: 'A-',
  B_PLUS: 'B+',
  B: 'B',
  B_MINUS: 'B-',
  C_PLUS: 'C+',
  C: 'C',
  C_MINUS: 'C-',
  D_PLUS: 'D+',
  D: 'D',
  D_MINUS: 'D-',
  F: 'F',
};

function formatCampusGrade(value: string) {
  return CAMPUS_GRADE_LABELS[value] ?? value;
}

const FALLBACK_RANKING_LIST_OPTIONS: RankingListOption[] = [
  {
    source: 'US_NEWS',
    list: 'US_NEWS_CORE',
    labelKey: 'core',
    year: null,
    count: 0,
    isDefault: true,
  },
  {
    source: 'US_NEWS',
    list: 'NATIONAL_UNIVERSITY',
    labelKey: 'nationalUniversity',
    year: null,
    count: 0,
    isDefault: false,
  },
  {
    source: 'US_NEWS',
    list: 'LIBERAL_ARTS',
    labelKey: 'liberalArts',
    year: null,
    count: 0,
    isDefault: false,
  },
  {
    source: 'US_NEWS',
    list: 'REGIONAL_UNIVERSITY',
    labelKey: 'regionalUniversity',
    year: null,
    count: 0,
    isDefault: false,
  },
  {
    source: 'US_NEWS',
    list: 'ART_DESIGN',
    labelKey: 'artDesign',
    year: null,
    count: 0,
    isDefault: false,
  },
  {
    source: 'US_NEWS',
    list: 'MUSIC',
    labelKey: 'music',
    year: null,
    count: 0,
    isDefault: false,
  },
  {
    source: 'US_NEWS',
    list: 'ENGINEERING_NO_PHD',
    labelKey: 'engineering',
    year: null,
    count: 0,
    isDefault: false,
  },
];

function formatRangeLabel(
  min: number | undefined,
  max: number | undefined,
  unit: (n: number) => string
): string {
  if (min != null && max != null) return `${unit(min)} – ${unit(max)}`;
  if (min != null) return `≥ ${unit(min)}`;
  if (max != null) return `≤ ${unit(max)}`;
  return '';
}

export function SchoolToolbar({
  total,
  page,
  pageSize,
  sortBy,
  onSortByChange,
  rankingList,
  rankingListOptions,
  onRankingListChange,
  viewMode,
  onViewModeChange,
  search,
  onClearSearch,
  country,
  showCountryChip,
  countryLabel,
  onClearCountry,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetAll,
}: SchoolToolbarProps) {
  const t = useTranslations('schools');
  const tt = useTranslations('schools.toolbar');
  const tc = useTranslations('common');
  const format = useFormatter();

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const availableRankingOptions = useMemo(() => {
    const options =
      rankingListOptions && rankingListOptions.length > 0
        ? rankingListOptions
        : FALLBACK_RANKING_LIST_OPTIONS;

    if (options.some((option) => option.list === rankingList)) {
      return options;
    }

    const fallback =
      FALLBACK_RANKING_LIST_OPTIONS.find((option) => option.list === rankingList) ??
      FALLBACK_RANKING_LIST_OPTIONS[0];
    return [...options, fallback];
  }, [rankingList, rankingListOptions]);

  const chips: ActiveFilterChip[] = useMemo(() => {
    const out: ActiveFilterChip[] = [];

    if (search) {
      out.push({
        key: 'search',
        label: `${tt('chip.search')}: ${search}`,
        onRemove: onClearSearch,
      });
    }
    if (showCountryChip && country !== 'ALL') {
      out.push({
        key: 'country',
        label: `${tt('chip.country')}: ${countryLabel}`,
        onRemove: onClearCountry,
      });
    }
    if (rankingList !== SCHOOL_DEFAULT_RANKING_LIST) {
      const option = availableRankingOptions.find((item) => item.list === rankingList);
      out.push({
        key: 'rankingList',
        label: option
          ? `US News ${tc(`rankingList.${option.labelKey}` as Parameters<typeof tc>[0])}`
          : `US News ${rankingList}`,
        onRemove: () => onRankingListChange(SCHOOL_DEFAULT_RANKING_LIST),
      });
    }
    if (advancedFilters.state) {
      out.push({
        key: 'state',
        label: `${tt('chip.state')}: ${advancedFilters.state}`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, state: undefined }),
      });
    }
    if (advancedFilters.region) {
      out.push({
        key: 'region',
        label: `${tt('chip.region')}: ${advancedFilters.region}`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, region: undefined }),
      });
    }

    const rankRange = formatRangeLabel(
      advancedFilters.rankMin,
      advancedFilters.rankMax,
      (n) => `#${n}`
    );
    if (rankRange) {
      out.push({
        key: 'rank',
        label: `${tt('chip.ranking')}: ${rankRange}`,
        onRemove: () =>
          onAdvancedFiltersChange({
            ...advancedFilters,
            rankMin: undefined,
            rankMax: undefined,
          }),
      });
    }

    const acceptanceRange = formatRangeLabel(
      advancedFilters.acceptanceMin,
      advancedFilters.acceptanceMax,
      (n) => `${n}%`
    );
    if (acceptanceRange) {
      out.push({
        key: 'acceptance',
        label: `${tt('chip.acceptance')}: ${acceptanceRange}`,
        onRemove: () =>
          onAdvancedFiltersChange({
            ...advancedFilters,
            acceptanceMin: undefined,
            acceptanceMax: undefined,
          }),
      });
    }

    const tuitionRange = formatRangeLabel(
      advancedFilters.tuitionMin,
      advancedFilters.tuitionMax,
      (n) => `$${n}0K`
    );
    if (tuitionRange) {
      out.push({
        key: 'tuition',
        label: `${tt('chip.tuition')}: ${tuitionRange}`,
        onRemove: () =>
          onAdvancedFiltersChange({
            ...advancedFilters,
            tuitionMin: undefined,
            tuitionMax: undefined,
          }),
      });
    }

    const sizeRange = formatRangeLabel(advancedFilters.sizeMin, advancedFilters.sizeMax, (n) =>
      format.number(n, 'standard')
    );
    if (sizeRange) {
      out.push({
        key: 'size',
        label: `${tt('chip.size')}: ${sizeRange}`,
        onRemove: () =>
          onAdvancedFiltersChange({
            ...advancedFilters,
            sizeMin: undefined,
            sizeMax: undefined,
          }),
      });
    }

    const salaryRange = formatRangeLabel(
      advancedFilters.salaryMin,
      advancedFilters.salaryMax,
      (n) => `$${n}0K`
    );
    if (salaryRange) {
      out.push({
        key: 'salary',
        label: `${tt('chip.salary')}: ${salaryRange}`,
        onRemove: () =>
          onAdvancedFiltersChange({
            ...advancedFilters,
            salaryMin: undefined,
            salaryMax: undefined,
          }),
      });
    }

    if (advancedFilters.schoolType) {
      out.push({
        key: 'schoolType',
        label: `${tt('chip.schoolType')}: ${advancedFilters.schoolType}`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, schoolType: undefined }),
      });
    }
    if (advancedFilters.testOptional) {
      out.push({
        key: 'testOptional',
        label: tt('chip.testOptional'),
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, testOptional: undefined }),
      });
    }
    if (advancedFilters.needBlind) {
      out.push({
        key: 'needBlind',
        label: tt('chip.needBlind'),
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, needBlind: undefined }),
      });
    }
    if (advancedFilters.hasEarlyDecision) {
      out.push({
        key: 'hasEarlyDecision',
        label: tt('chip.hasEarlyDecision'),
        onRemove: () =>
          onAdvancedFiltersChange({ ...advancedFilters, hasEarlyDecision: undefined }),
      });
    }
    if (advancedFilters.minSafetyGrade) {
      out.push({
        key: 'minSafetyGrade',
        label: `${tt('chip.safety')}: ${formatCampusGrade(advancedFilters.minSafetyGrade)}+`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, minSafetyGrade: undefined }),
      });
    }
    if (advancedFilters.minLifeGrade) {
      out.push({
        key: 'minLifeGrade',
        label: `${tt('chip.life')}: ${formatCampusGrade(advancedFilters.minLifeGrade)}+`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, minLifeGrade: undefined }),
      });
    }
    if (advancedFilters.minFoodGrade) {
      out.push({
        key: 'minFoodGrade',
        label: `${tt('chip.food')}: ${formatCampusGrade(advancedFilters.minFoodGrade)}+`,
        onRemove: () => onAdvancedFiltersChange({ ...advancedFilters, minFoodGrade: undefined }),
      });
    }

    return out;
  }, [
    search,
    onClearSearch,
    showCountryChip,
    country,
    countryLabel,
    onClearCountry,
    rankingList,
    availableRankingOptions,
    onRankingListChange,
    advancedFilters,
    onAdvancedFiltersChange,
    tt,
    tc,
    format,
  ]);

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-border/60 bg-card/40 backdrop-blur-sm">
      {/* Top row: result count + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-lg font-bold text-foreground">
          {t('resultsCount', { count: total })}
          {total > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground/70">
              · {tt('rangeReadout', { from, to, total })}
            </span>
          )}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SchoolSortBy)}>
            <SelectTrigger className="h-10 w-[148px]" aria-label={tt('sortLabel')}>
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">{t('sort.rank')}</SelectItem>
              <SelectItem value="name">{t('sort.name')}</SelectItem>
              <SelectItem value="acceptance">{t('sort.acceptance')}</SelectItem>
              <SelectItem value="salary">{t('sort.salary')}</SelectItem>
              <SelectItem value="weighted">{t('weightSort')}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={rankingList}
            onValueChange={(v) => onRankingListChange(v as SchoolRankingList)}
          >
            <SelectTrigger className="h-10 w-[190px]" aria-label={tt('rankingListLabel')}>
              <Trophy className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRankingOptions.map((option) => (
                <SelectItem key={option.list} value={option.list}>
                  US News {tc(`rankingList.${option.labelKey}` as Parameters<typeof tc>[0])}
                  {option.count > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({format.number(option.count, 'standard')})
                    </span>
                  )}
                  {option.fallbackCount ? (
                    <span className="ml-1 text-xs text-amber-600">
                      {tt('rankingFallbackCount', { count: option.fallbackCount })}
                    </span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div
            className="flex min-h-11 items-center rounded-md border border-border/70 bg-background p-0.5"
            role="radiogroup"
            aria-label={tt('view')}
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'card'}
              aria-label={tt('viewCard')}
              onClick={() => onViewModeChange('card')}
              className={cn(
                'flex h-10 min-w-10 items-center justify-center gap-1 rounded-sm px-3 text-xs font-medium transition-colors',
                viewMode === 'card'
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tt('viewCard')}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'list'}
              aria-label={tt('viewList')}
              onClick={() => onViewModeChange('list')}
              className={cn(
                'flex h-10 min-w-10 items-center justify-center gap-1 rounded-sm px-3 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tt('viewList')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active chips row */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 text-xs">
              <span className="max-w-[180px] truncate">{chip.label}</span>
              <button
                onClick={chip.onRemove}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                aria-label={tt('removeFilter')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {chips.length >= 2 && (
            <Button variant="ghost" size="sm" onClick={onResetAll} className="h-10 px-3 text-xs">
              {tt('resetAll')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
