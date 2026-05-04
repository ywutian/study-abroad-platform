'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Globe, Search } from 'lucide-react';
import { schoolRoutes } from '@study-abroad/shared';
import { AdvancedSchoolFilter } from '@/components/features';
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
  activeAdvancedFilterCount: number;
  activeFilterCount: number;
  activePreset: string;
  onActivePresetChange: (preset: string) => void;
  weightPresetKeys: string[];
  fitWeights: SchoolWeightParams;
  onFitWeightsChange: (weights: SchoolWeightParams) => void;
}

export function SchoolFilterBar({
  search,
  onSearchChange,
  country,
  onCountryChange,
  advancedFilters,
  onAdvancedFiltersChange,
  onResetAdvancedFilters,
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

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-primary" />
      <CardContent className="space-y-6 pt-5">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {showCountryFilter && (
            <Select value={country} onValueChange={onCountryChange}>
              <SelectTrigger>
                <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
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
        </div>

        <div className="space-y-4 border-t pt-5">
          <div>
            <h3 className="text-sm font-semibold">{t('weightControls.title')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('weightControls.description')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {weightPresetKeys.map((key) => (
              <Button
                key={key}
                variant={activePreset === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => onActivePresetChange(key)}
              >
                {t(`weightControls.presets.${key}`)}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {(
              [
                ['ranking', 'ranking'],
                ['acceptanceRate', 'acceptanceRate'],
                ['tuition', 'tuition'],
                ['salary', 'salary'],
              ] as const
            ).map(([key, labelKey]) => (
              <div key={key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm">{t(`weightControls.weights.${labelKey}`)}</Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {fitWeights[key]}%
                  </span>
                </div>
                <Slider
                  value={[fitWeights[key]]}
                  min={0}
                  max={80}
                  step={5}
                  onValueChange={([value]) => onFitWeightsChange({ ...fitWeights, [key]: value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t('filterOptions')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t('filterOptionsDesc')}</p>
            </div>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {activeFilterCount}
              </Badge>
            )}
          </div>

          <div className="lg:hidden">
            <AdvancedSchoolFilter
              country={filterCountry}
              filters={advancedFilters}
              onChange={onAdvancedFiltersChange}
              onReset={onResetAdvancedFilters}
              activeCount={activeAdvancedFilterCount}
            />
          </div>

          <AdvancedSchoolFilter
            country={filterCountry}
            filters={advancedFilters}
            onChange={onAdvancedFiltersChange}
            onReset={onResetAdvancedFilters}
            activeCount={activeAdvancedFilterCount}
            variant="inline"
            className="hidden lg:block"
          />
        </div>
      </CardContent>
    </Card>
  );
}
