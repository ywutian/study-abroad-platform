/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import {
  SlidersHorizontal,
  DollarSign,
  Trophy,
  Users,
  MapPin,
  Building2,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SCHOOL_FILTER_DEFAULTS, type SchoolFilters } from './school-filters';

export type { SchoolFilters } from './school-filters';

interface AdvancedSchoolFilterProps {
  country: string;
  filters: SchoolFilters;
  onChange: (filters: SchoolFilters) => void;
  onReset: () => void;
  activeCount: number;
  variant?: 'sheet' | 'inline';
  className?: string;
}

const US_STATES = [
  { value: 'all', label: 'All states' },
  { value: 'AL', label: 'AL' },
  { value: 'AK', label: 'AK' },
  { value: 'AZ', label: 'AZ' },
  { value: 'AR', label: 'AR' },
  { value: 'CA', label: 'CA' },
  { value: 'CO', label: 'CO' },
  { value: 'CT', label: 'CT' },
  { value: 'DE', label: 'DE' },
  { value: 'DC', label: 'DC' },
  { value: 'FL', label: 'FL' },
  { value: 'GA', label: 'GA' },
  { value: 'HI', label: 'HI' },
  { value: 'ID', label: 'ID' },
  { value: 'IL', label: 'IL' },
  { value: 'IN', label: 'IN' },
  { value: 'IA', label: 'IA' },
  { value: 'KS', label: 'KS' },
  { value: 'KY', label: 'KY' },
  { value: 'LA', label: 'LA' },
  { value: 'ME', label: 'ME' },
  { value: 'MD', label: 'MD' },
  { value: 'MA', label: 'MA' },
  { value: 'MI', label: 'MI' },
  { value: 'MN', label: 'MN' },
  { value: 'MS', label: 'MS' },
  { value: 'MO', label: 'MO' },
  { value: 'MT', label: 'MT' },
  { value: 'NE', label: 'NE' },
  { value: 'NV', label: 'NV' },
  { value: 'NH', label: 'NH' },
  { value: 'NJ', label: 'NJ' },
  { value: 'NM', label: 'NM' },
  { value: 'NY', label: 'NY' },
  { value: 'NC', label: 'NC' },
  { value: 'ND', label: 'ND' },
  { value: 'OH', label: 'OH' },
  { value: 'OK', label: 'OK' },
  { value: 'OR', label: 'OR' },
  { value: 'PA', label: 'PA' },
  { value: 'RI', label: 'RI' },
  { value: 'SC', label: 'SC' },
  { value: 'SD', label: 'SD' },
  { value: 'TN', label: 'TN' },
  { value: 'TX', label: 'TX' },
  { value: 'UT', label: 'UT' },
  { value: 'VT', label: 'VT' },
  { value: 'VA', label: 'VA' },
  { value: 'WA', label: 'WA' },
  { value: 'WV', label: 'WV' },
  { value: 'WI', label: 'WI' },
  { value: 'WY', label: 'WY' },
];

export function AdvancedSchoolFilter({
  country,
  filters,
  onChange,
  onReset,
  activeCount,
  variant = 'sheet',
  className,
}: AdvancedSchoolFilterProps) {
  const t = useTranslations('schoolFilter');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'location',
    'ranking',
    'acceptance',
    'salary',
  ]);

  const regions = [
    { value: 'all', label: t('regions.all') },
    { value: 'northeast', label: t('regions.northeast') },
    { value: 'midwest', label: t('regions.midwest') },
    { value: 'south', label: t('regions.south') },
    { value: 'west', label: t('regions.west') },
  ];

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const updateFilter = <K extends keyof SchoolFilters>(key: K, value: SchoolFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const updateRange = <MinKey extends keyof SchoolFilters, MaxKey extends keyof SchoolFilters>(
    minKey: MinKey,
    maxKey: MaxKey,
    min: number,
    max: number,
    defaultMin: number,
    defaultMax: number
  ) => {
    onChange({
      ...filters,
      [minKey]: min === defaultMin ? undefined : min,
      [maxKey]: max === defaultMax ? undefined : max,
    });
  };

  const content = (
    <div className={cn('space-y-4', variant === 'sheet' && 'pb-2')}>
      {country === 'US' && (
        <FilterSection
          title={t('sections.location')}
          icon={MapPin}
          expanded={expandedSections.includes('location')}
          onToggle={() => toggleSection('location')}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('labels.state')}</Label>
              <Select
                value={filters.state || 'all'}
                onValueChange={(value) =>
                  onChange({
                    ...filters,
                    state: value === 'all' ? undefined : value,
                    region: undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholders.selectState')} />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.value === 'all' ? t('states.all') : state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{t('labels.region')}</Label>
              <Select
                value={filters.region || 'all'}
                onValueChange={(value) =>
                  onChange({
                    ...filters,
                    state: undefined,
                    region: value === 'all' ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholders.selectRegion')} />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FilterSection>
      )}

      <FilterSection
        title={t('sections.ranking')}
        icon={Trophy}
        expanded={expandedSections.includes('ranking')}
        onToggle={() => toggleSection('ranking')}
        badge={
          filters.rankMin || filters.rankMax
            ? `#${filters.rankMin || 1}-${filters.rankMax || 100}`
            : undefined
        }
      >
        <div className="space-y-4">
          <RangeLabel
            label={t('labels.usNewsRanking')}
            value={`#${filters.rankMin || 1} - #${filters.rankMax || 100}`}
          />
          <Slider
            value={[
              filters.rankMin ?? SCHOOL_FILTER_DEFAULTS.rankMin,
              filters.rankMax ?? SCHOOL_FILTER_DEFAULTS.rankMax,
            ]}
            onValueChange={([min, max]) =>
              updateRange(
                'rankMin',
                'rankMax',
                min,
                max,
                SCHOOL_FILTER_DEFAULTS.rankMin,
                SCHOOL_FILTER_DEFAULTS.rankMax
              )
            }
            min={SCHOOL_FILTER_DEFAULTS.rankMin}
            max={SCHOOL_FILTER_DEFAULTS.rankMax}
            step={1}
          />
          <PresetButtons
            presets={[
              { key: 'top10', min: 1, max: 10 },
              { key: 'top30', min: 1, max: 30 },
              { key: 'top50', min: 1, max: 50 },
              { key: 'range30To50', min: 30, max: 50 },
              { key: 'range50To100', min: 50, max: 100 },
            ]}
            activeMin={filters.rankMin}
            activeMax={filters.rankMax}
            label={(key) => t(`rankingPresets.${key}`)}
            onSelect={(min, max) => {
              updateFilter('rankMin', min);
              updateFilter('rankMax', max);
            }}
          />
        </div>
      </FilterSection>

      <FilterSection
        title={t('sections.acceptance')}
        icon={Users}
        expanded={expandedSections.includes('acceptance')}
        onToggle={() => toggleSection('acceptance')}
        badge={
          filters.acceptanceMin || filters.acceptanceMax
            ? `${filters.acceptanceMin || 0}%-${filters.acceptanceMax || 100}%`
            : undefined
        }
      >
        <div className="space-y-4">
          <RangeLabel
            label={t('labels.acceptanceRange')}
            value={`${filters.acceptanceMin || 0}% - ${filters.acceptanceMax || 100}%`}
          />
          <Slider
            value={[
              filters.acceptanceMin ?? SCHOOL_FILTER_DEFAULTS.acceptanceMin,
              filters.acceptanceMax ?? SCHOOL_FILTER_DEFAULTS.acceptanceMax,
            ]}
            onValueChange={([min, max]) =>
              updateRange(
                'acceptanceMin',
                'acceptanceMax',
                min,
                max,
                SCHOOL_FILTER_DEFAULTS.acceptanceMin,
                SCHOOL_FILTER_DEFAULTS.acceptanceMax
              )
            }
            min={SCHOOL_FILTER_DEFAULTS.acceptanceMin}
            max={SCHOOL_FILTER_DEFAULTS.acceptanceMax}
            step={5}
          />
          <PresetButtons
            presets={[
              { key: 'veryHard', min: 0, max: 10 },
              { key: 'hard', min: 10, max: 20 },
              { key: 'medium', min: 20, max: 40 },
              { key: 'easy', min: 40, max: 100 },
            ]}
            activeMin={filters.acceptanceMin}
            activeMax={filters.acceptanceMax}
            label={(key) => t(`acceptancePresets.${key}`)}
            onSelect={(min, max) => {
              updateFilter('acceptanceMin', min);
              updateFilter('acceptanceMax', max);
            }}
          />
        </div>
      </FilterSection>

      <FilterSection
        title={t('sections.tuition')}
        icon={DollarSign}
        expanded={expandedSections.includes('tuition')}
        onToggle={() => toggleSection('tuition')}
        badge={
          filters.tuitionMin || filters.tuitionMax
            ? `$${filters.tuitionMin || 0}0k-${filters.tuitionMax || 8}0k`
            : undefined
        }
      >
        <div className="space-y-4">
          <RangeLabel
            label={t('labels.annualTuition')}
            value={`$${filters.tuitionMin || 0}0k - $${filters.tuitionMax || 8}0k`}
          />
          <Slider
            value={[
              filters.tuitionMin ?? SCHOOL_FILTER_DEFAULTS.tuitionMin,
              filters.tuitionMax ?? SCHOOL_FILTER_DEFAULTS.tuitionMax,
            ]}
            onValueChange={([min, max]) =>
              updateRange(
                'tuitionMin',
                'tuitionMax',
                min,
                max,
                SCHOOL_FILTER_DEFAULTS.tuitionMin,
                SCHOOL_FILTER_DEFAULTS.tuitionMax
              )
            }
            min={SCHOOL_FILTER_DEFAULTS.tuitionMin}
            max={SCHOOL_FILTER_DEFAULTS.tuitionMax}
            step={0.5}
          />
          <PresetButtons
            presets={[
              { key: 'budget', min: 0, max: 3 },
              { key: 'moderate', min: 3, max: 5 },
              { key: 'high', min: 5, max: 7 },
              { key: 'noLimit', min: 0, max: 8 },
            ]}
            activeMin={filters.tuitionMin}
            activeMax={filters.tuitionMax}
            label={(key) => t(`tuitionPresets.${key}`)}
            onSelect={(min, max) => {
              updateFilter('tuitionMin', min);
              updateFilter('tuitionMax', max);
            }}
          />
        </div>
      </FilterSection>

      <FilterSection
        title={t('sections.salary')}
        icon={TrendingUp}
        expanded={expandedSections.includes('salary')}
        onToggle={() => toggleSection('salary')}
        badge={
          filters.salaryMin || filters.salaryMax
            ? `$${filters.salaryMin || 0}0k-${filters.salaryMax || 20}0k`
            : undefined
        }
      >
        <div className="space-y-4">
          <RangeLabel
            label={t('labels.postGradSalary')}
            value={`$${filters.salaryMin || 0}0k - $${filters.salaryMax || 20}0k`}
          />
          <Slider
            value={[
              filters.salaryMin ?? SCHOOL_FILTER_DEFAULTS.salaryMin,
              filters.salaryMax ?? SCHOOL_FILTER_DEFAULTS.salaryMax,
            ]}
            onValueChange={([min, max]) =>
              updateRange(
                'salaryMin',
                'salaryMax',
                min,
                max,
                SCHOOL_FILTER_DEFAULTS.salaryMin,
                SCHOOL_FILTER_DEFAULTS.salaryMax
              )
            }
            min={SCHOOL_FILTER_DEFAULTS.salaryMin}
            max={SCHOOL_FILTER_DEFAULTS.salaryMax}
            step={1}
          />
        </div>
      </FilterSection>

      <FilterSection
        title={t('sections.type')}
        icon={Building2}
        expanded={expandedSections.includes('type')}
        onToggle={() => toggleSection('type')}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">{t('labels.publicPrivate')}</Label>
            <Select
              value={filters.schoolType || 'all'}
              onValueChange={(v) =>
                updateFilter('schoolType', v === 'all' ? undefined : (v as any))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('placeholders.selectType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('schoolTypes.all')}</SelectItem>
                <SelectItem value="public">{t('schoolTypes.public')}</SelectItem>
                <SelectItem value="private">{t('schoolTypes.private')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-sm">{t('labels.schoolSize')}</Label>
            <RangeLabel
              label=""
              value={`${format.number(filters.sizeMin || 0, 'standard')} - ${format.number(
                filters.sizeMax || 50000,
                'standard'
              )}`}
            />
            <Slider
              value={[
                filters.sizeMin ?? SCHOOL_FILTER_DEFAULTS.sizeMin,
                filters.sizeMax ?? SCHOOL_FILTER_DEFAULTS.sizeMax,
              ]}
              onValueChange={([min, max]) =>
                updateRange(
                  'sizeMin',
                  'sizeMax',
                  min,
                  max,
                  SCHOOL_FILTER_DEFAULTS.sizeMin,
                  SCHOOL_FILTER_DEFAULTS.sizeMax
                )
              }
              min={SCHOOL_FILTER_DEFAULTS.sizeMin}
              max={SCHOOL_FILTER_DEFAULTS.sizeMax}
              step={1000}
            />
          </div>
        </div>
      </FilterSection>

      <FilterSection
        title={t('sections.special')}
        icon={Sparkles}
        expanded={expandedSections.includes('special')}
        onToggle={() => toggleSection('special')}
      >
        <div className="space-y-4">
          <SwitchRow
            label={t('specialConditions.testOptional')}
            description={t('specialConditions.testOptionalDesc')}
            checked={filters.testOptional || false}
            onCheckedChange={(checked) => updateFilter('testOptional', checked || undefined)}
          />
          <SwitchRow
            label={t('specialConditions.needBlind')}
            description={t('specialConditions.needBlindDesc')}
            checked={filters.needBlind || false}
            onCheckedChange={(checked) => updateFilter('needBlind', checked || undefined)}
          />
          <SwitchRow
            label={t('specialConditions.hasED')}
            description={t('specialConditions.hasEDDesc')}
            checked={filters.hasEarlyDecision || false}
            onCheckedChange={(checked) => updateFilter('hasEarlyDecision', checked || undefined)}
          />
        </div>
      </FilterSection>
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className={cn('space-y-4', className)}>
        {content}
        <Button variant="outline" onClick={onReset} className="w-full gap-2">
          <RotateCcw className="h-4 w-4" />
          {t('reset')}
        </Button>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <SlidersHorizontal className="h-4 w-4" />
          {t('title')}
          {activeCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="h-dvh max-h-dvh w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-border/60 px-6 py-5 pr-16">
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t('title')}
          </SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div
          data-lenis-prevent=""
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 touch-pan-y [-webkit-overflow-scrolling:touch]"
        >
          {content}
        </div>

        <SheetFooter className="mt-0 shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 supports-[backdrop-filter]:bg-background/80 sm:flex-row">
          <Button variant="outline" onClick={onReset} className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            {t('reset')}
          </Button>
          <Button
            onClick={() => setOpen(false)}
            className="flex-1 gap-2 bg-primary dark:bg-primary hover:opacity-90"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('apply')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RangeLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {label ? <span className="text-muted-foreground">{label}</span> : <span />}
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PresetButtons({
  presets,
  activeMin,
  activeMax,
  label,
  onSelect,
}: {
  presets: Array<{ key: string; min: number; max: number }>;
  activeMin?: number;
  activeMax?: number;
  label: (key: string) => string;
  onSelect: (min: number, max: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.key}
          variant="outline"
          size="sm"
          className={cn(
            'text-xs',
            activeMin === preset.min && activeMax === preset.max && 'border-primary bg-primary/5'
          )}
          onClick={() => onSelect(preset.min, preset.max)}
        >
          {label(preset.key)}
        </Button>
      ))}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FilterSection({
  title,
  icon: Icon,
  expanded,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon: any;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="truncate text-sm font-medium">{title}</span>
            {badge && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {badge}
              </Badge>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4 pb-2 px-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
