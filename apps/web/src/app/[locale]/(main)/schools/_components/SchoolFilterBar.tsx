/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, SlidersHorizontal, Filter, Globe, X } from 'lucide-react';
import { schoolRoutes } from '@study-abroad/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { AdvancedSchoolFilter } from '@/components/features';
import {
  applyTuitionPreset,
  getTuitionPresetValue,
  type TuitionPresetValue,
  type SchoolFilters,
} from '@/components/features/schools/school-filters';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

// Country code → i18n label key (matches messages/{en,zh}.json `schools.countries.*`)
const COUNTRY_LABEL_KEYS: Record<string, string> = {
  US: 'us',
  USA: 'us',
  UK: 'uk',
  GB: 'uk',
  CA: 'canada',
  AU: 'australia',
  DE: 'germany',
  JP: 'japan',
};

interface AvailableCountry {
  code: string;
  count: number;
}

const tuitionRanges = [
  { value: 'ALL', labelKey: 'all' },
  { value: 'CUSTOM', labelKey: 'custom' },
  { value: '20-30', labelKey: '20k-30k' },
  { value: '30-40', labelKey: '30k-40k' },
  { value: '40-50', labelKey: '40k-50k' },
  { value: '50+', labelKey: '50k+' },
];

interface SchoolFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  advancedFilters: SchoolFilters;
  onAdvancedFiltersChange: (filters: SchoolFilters) => void;
  onResetAdvancedFilters: () => void;
  activeAdvancedFilterCount: number;
  activeFilterCount: number;
  activePreset: string;
  onActivePresetChange: (preset: string) => void;
  weightPresetKeys: string[];
}

export function SchoolFilterBar({
  search,
  onSearchChange,
  country,
  onCountryChange,
  sortBy,
  onSortByChange,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetAdvancedFilters,
  activeAdvancedFilterCount,
  activeFilterCount,
  activePreset,
  onActivePresetChange,
  weightPresetKeys,
}: SchoolFilterBarProps) {
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const quickTuitionRange = getTuitionPresetValue(advancedFilters);

  // Fetch countries that actually have schools — avoids the UX bug where
  // users select "UK" from a hardcoded list only to get zero results.
  const { data: availableCountries } = useQuery<AvailableCountry[]>({
    queryKey: ['schools', 'countries'],
    queryFn: () => apiClient.get(schoolRoutes.countries()),
    staleTime: 5 * 60 * 1000, // 5 min — matches backend cache
  });

  const countries = useMemo(() => {
    const items = availableCountries ?? [];
    // Fallback while loading: show nothing. Component hides filter when empty.
    if (items.length === 0) return [];

    // Build [ALL, ...actual countries] — sorted by count desc (backend already sorts)
    return [
      { value: 'ALL', labelKey: 'all', count: null as number | null },
      ...items.map((c) => ({
        value: c.code,
        labelKey: COUNTRY_LABEL_KEYS[c.code] ?? c.code.toLowerCase(),
        count: c.count,
      })),
    ];
  }, [availableCountries]);

  // Hide country filter entirely when only 1 country has data (no meaningful choice)
  const showCountryFilter = countries.length > 2; // ALL + 1 country = hidden

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Country Filter — only shown when 2+ countries have schools */}
          {showCountryFilter && (
            <Select value={country} onValueChange={onCountryChange}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('country')} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {t(`countries.${c.labelKey}`)}
                    {c.count !== null && (
                      <span className="ml-1 text-xs text-muted-foreground">({c.count})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort */}
          <Select value={sortBy} onValueChange={onSortByChange}>
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
                    value={advancedFilters.schoolType || 'all'}
                    onValueChange={(value) =>
                      onAdvancedFiltersChange({
                        ...advancedFilters,
                        schoolType: value === 'all' ? undefined : (value as 'public' | 'private'),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tc('all')}</SelectItem>
                      <SelectItem value="public">{t('public')}</SelectItem>
                      <SelectItem value="private">{t('private')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('tuitionRange')}</Label>
                  <Select
                    value={quickTuitionRange}
                    onValueChange={(value) => {
                      if (value === 'CUSTOM') return;
                      onAdvancedFiltersChange(
                        applyTuitionPreset(
                          advancedFilters,
                          value as Exclude<TuitionPresetValue, 'CUSTOM'>
                        )
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tuitionRanges.map((range) => (
                        <SelectItem
                          key={range.value}
                          value={range.value}
                          disabled={range.value === 'CUSTOM'}
                        >
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
                  onClick={() =>
                    onAdvancedFiltersChange({
                      ...advancedFilters,
                      schoolType: undefined,
                      tuitionMin: undefined,
                      tuitionMax: undefined,
                    })
                  }
                >
                  {t('resetFilters')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Advanced Filter */}
          <AdvancedSchoolFilter
            country={country}
            filters={advancedFilters}
            onChange={onAdvancedFiltersChange}
            onReset={onResetAdvancedFilters}
            activeCount={activeAdvancedFilterCount}
          />
        </div>

        {/* Active Filters */}
        {(search || (showCountryFilter && country !== 'ALL')) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {search && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <Search className="h-3 w-3" />
                {search}
                <button
                  onClick={() => onSearchChange('')}
                  className="ml-1 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {showCountryFilter && country !== 'ALL' && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <Globe className="h-3 w-3" />
                {(() => {
                  const match = countries.find((c) => c.value === country);
                  return match ? t(`countries.${match.labelKey}`) : country;
                })()}
                <button
                  onClick={() => onCountryChange('ALL')}
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
                {weightPresetKeys.map((key) => (
                  <Button
                    key={key}
                    variant={activePreset === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onActivePresetChange(key)}
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
  );
}
