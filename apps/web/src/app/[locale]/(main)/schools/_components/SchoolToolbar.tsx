'use client';

import { useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
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
  type SchoolFilters,
  type SchoolSortBy,
} from '@/components/features/schools/school-filters';

export type SchoolViewMode = 'card' | 'list';
export type SchoolDensity = 'comfortable' | 'compact';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface SchoolToolbarProps {
  total: number;
  page: number;
  pageSize: number;
  sortBy: SchoolSortBy;
  onSortByChange: (value: SchoolSortBy) => void;
  viewMode: SchoolViewMode;
  onViewModeChange: (mode: SchoolViewMode) => void;
  density: SchoolDensity;
  onDensityChange: (density: SchoolDensity) => void;
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
  viewMode,
  onViewModeChange,
  density,
  onDensityChange,
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
  const format = useFormatter();

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

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

    return out;
  }, [
    search,
    onClearSearch,
    showCountryChip,
    country,
    countryLabel,
    onClearCountry,
    advancedFilters,
    onAdvancedFiltersChange,
    tt,
    format,
  ]);

  return (
    <div className="rounded-[var(--theme-radius-card)] border border-border/60 bg-card/40 backdrop-blur-sm">
      {/* Top row: total/range + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t('resultsCount', { count: total })}</span>
          {total > 0 && (
            <>
              {' · '}
              <span>{tt('rangeReadout', { from, to, total })}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SchoolSortBy)}>
            <SelectTrigger className="h-9 w-[148px]" aria-label={tt('sortLabel')}>
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

          {/* Density (only for card view) */}
          {viewMode === 'card' && (
            <div
              className="flex h-9 items-center rounded-md border border-border/70 bg-background p-0.5"
              role="radiogroup"
              aria-label={tt('density')}
            >
              {(['comfortable', 'compact'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={density === d}
                  onClick={() => onDensityChange(d)}
                  className={cn(
                    'rounded-sm px-2 py-1 text-xs font-medium transition-colors',
                    density === d
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tt(d === 'comfortable' ? 'densityComfortable' : 'densityCompact')}
                </button>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div
            className="flex h-9 items-center rounded-md border border-border/70 bg-background p-0.5"
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
                'flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors',
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
                'flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors',
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
                className="rounded-full p-0.5 hover:bg-muted"
                aria-label={tt('removeFilter')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {chips.length >= 2 && (
            <Button variant="ghost" size="sm" onClick={onResetAll} className="h-7 px-2 text-xs">
              {tt('resetAll')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
