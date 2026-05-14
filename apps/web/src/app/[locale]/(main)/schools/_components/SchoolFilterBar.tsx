'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Globe, Search } from 'lucide-react';
import { schoolRoutes } from '@study-abroad/shared';
import { AdvancedSchoolFilter } from '@/components/features';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { apiClient } from '@/lib/api';
import {
  type SchoolFilters,
  type SchoolWeightParams,
} from '@/components/features/schools/school-filters';

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

interface SchoolFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  advancedFilters: SchoolFilters;
  onAdvancedFiltersChange: (filters: SchoolFilters) => void;
  onResetAdvancedFilters: () => void;
  onResetAll: () => void;
  activeAdvancedFilterCount: number;
  activeFilterCount: number;
  activePreset: string;
  onActivePresetChange: (preset: string) => void;
  weightPresetKeys: string[];
  fitWeights: SchoolWeightParams;
  onFitWeightsChange: (weights: SchoolWeightParams) => void;
}

const sliderClass =
  '[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[data-slot=slider-range]]:bg-blue-600 dark:[&_[role=slider]]:bg-blue-500 dark:[&_[role=slider]]:border-blue-500 dark:[&_[data-slot=slider-range]]:bg-blue-500';

export function SchoolFilterBar({
  search,
  onSearchChange,
  country,
  onCountryChange,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetAdvancedFilters,
  onResetAll,
  activeAdvancedFilterCount,
  activeFilterCount,
  activePreset,
  onActivePresetChange,
  weightPresetKeys,
  fitWeights,
  onFitWeightsChange,
}: SchoolFilterBarProps) {
  const t = useTranslations('schools');

  const { data: availableCountries } = useQuery<AvailableCountry[]>({
    queryKey: ['schools', 'countries'],
    queryFn: () => apiClient.get(schoolRoutes.countries(), { suppressErrorToast: true }),
    staleTime: 5 * 60 * 1000,
  });

  const countries = useMemo(() => {
    const items = availableCountries ?? [];
    if (items.length === 0) return [];

    return [
      { value: 'ALL', labelKey: 'all', count: null as number | null },
      ...items.map((c) => ({
        value: c.code,
        labelKey: COUNTRY_LABEL_KEYS[c.code] ?? c.code.toLowerCase(),
        count: c.count,
      })),
    ];
  }, [availableCountries]);

  const showCountryFilter = countries.length > 2;
  const filterCountry = country === 'ALL' && !showCountryFilter ? 'US' : country;

  const defaultOpenSections = useMemo(() => {
    const sections = ['schools', 'weights', 'advanced'];
    if (showCountryFilter) sections.push('country');
    return sections;
  }, [showCountryFilter]);

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-blue-500 dark:bg-blue-400" />
      <CardContent className="space-y-1 pt-5">
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-base font-semibold">{t('filtersTitle')}</h2>
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
            disabled={activeFilterCount === 0}
          >
            {t('resetAll')}
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
        </div>

        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
          <AccordionItem value="schools" className="border-b border-border/60">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              {t('sectionSchools')}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {showCountryFilter && (
            <AccordionItem value="country" className="border-b border-border/60">
              <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                {t('sectionCountry')}
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-1">
                <Select value={country} onValueChange={onCountryChange}>
                  <SelectTrigger>
                    <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder={t('country')} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(`countries.${c.labelKey}` as Parameters<typeof t>[0])}
                        {c.count !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">({c.count})</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="weights" className="border-b border-border/60">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              {t('sectionWeights')}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <p className="mb-3 text-xs text-muted-foreground">
                {t('weightControls.description')}
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                {weightPresetKeys.map((key) => (
                  <Button
                    key={key}
                    variant={activePreset === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onActivePresetChange(key)}
                    className={
                      activePreset === key
                        ? 'h-8 bg-blue-600 text-xs text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                        : 'h-8 text-xs'
                    }
                  >
                    {t(`weightControls.presets.${key}` as Parameters<typeof t>[0])}
                  </Button>
                ))}
              </div>

              <div className="space-y-4">
                {(
                  [
                    ['ranking', 'ranking'],
                    ['acceptanceRate', 'acceptanceRate'],
                    ['tuition', 'tuition'],
                    ['salary', 'salary'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <Label className="font-medium text-muted-foreground">
                        {t(`weightControls.weights.${labelKey}` as Parameters<typeof t>[0])}
                      </Label>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {fitWeights[key]}%
                      </span>
                    </div>
                    <Slider
                      value={[fitWeights[key]]}
                      min={0}
                      max={80}
                      step={5}
                      onValueChange={([value]) =>
                        onFitWeightsChange({ ...fitWeights, [key]: value })
                      }
                      className={sliderClass}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="advanced" className="border-b-0">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                {t('sectionFilters')}
                {activeAdvancedFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 px-1.5 text-2xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    {activeAdvancedFilterCount}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pt-1">
              <AdvancedSchoolFilter
                country={filterCountry}
                filters={advancedFilters}
                onChange={onAdvancedFiltersChange}
                onReset={onResetAdvancedFilters}
                activeCount={activeAdvancedFilterCount}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
