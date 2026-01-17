'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  X,
  DollarSign,
  Trophy,
  Users,
  MapPin,
  GraduationCap,
  Building2,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
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

export interface SchoolFilters {
  // 基础筛选
  country?: string;
  state?: string;

  // 排名范围
  rankMin?: number;
  rankMax?: number;

  // 录取率范围
  acceptanceMin?: number;
  acceptanceMax?: number;

  // 学费范围 (单位: 万美元)
  tuitionMin?: number;
  tuitionMax?: number;

  // 学校规模
  sizeMin?: number;
  sizeMax?: number;

  // 特殊条件
  testOptional?: boolean;
  needBlind?: boolean;
  hasEarlyDecision?: boolean;

  // 学校类型
  schoolType?: 'public' | 'private' | 'all';

  // 地区偏好
  region?: string;
}

interface AdvancedSchoolFilterProps {
  filters: SchoolFilters;
  onChange: (filters: SchoolFilters) => void;
  onReset: () => void;
  activeCount: number;
}

const US_STATES = [
  { value: 'all', label: 'All States' },
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'TX', label: 'Texas' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'IL', label: 'Illinois' },
  { value: 'FL', label: 'Florida' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'GA', label: 'Georgia' },
  { value: 'OH', label: 'Ohio' },
];

export function AdvancedSchoolFilter({
  filters,
  onChange,
  onReset,
  activeCount,
}: AdvancedSchoolFilterProps) {
  const t = useTranslations('schoolFilter');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['ranking', 'acceptance']);

  const REGIONS = [
    { value: 'all', label: t('regions.all') },
    { value: 'northeast', label: t('regions.northeast') },
    { value: 'midwest', label: t('regions.midwest') },
    { value: 'south', label: t('regions.south') },
    { value: 'west', label: t('regions.west') },
  ];

  const COUNTRIES = [
    { value: 'all', label: t('countries.all') },
    { value: 'US', label: t('countries.us') },
    { value: 'UK', label: t('countries.uk') },
    { value: 'CA', label: t('countries.ca') },
    { value: 'AU', label: t('countries.au') },
  ];

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const updateFilter = <K extends keyof SchoolFilters>(key: K, value: SchoolFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

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

      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t('title')}
          </SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* 地理位置 */}
          <FilterSection
            title={t('sections.location')}
            icon={MapPin}
            expanded={expandedSections.includes('location')}
            onToggle={() => toggleSection('location')}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">{t('labels.country')}</Label>
                <Select
                  value={filters.country || 'all'}
                  onValueChange={(v) => updateFilter('country', v === 'all' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('placeholders.selectCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filters.country === 'US' && (
                <div className="space-y-2">
                  <Label className="text-sm">{t('labels.state')}</Label>
                  <Select
                    value={filters.state || 'all'}
                    onValueChange={(v) => updateFilter('state', v === 'all' ? undefined : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('placeholders.selectState')} />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">{t('labels.region')}</Label>
                <Select
                  value={filters.region || 'all'}
                  onValueChange={(v) => updateFilter('region', v === 'all' ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('placeholders.selectRegion')} />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterSection>

          {/* 排名范围 */}
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('labels.usNewsRanking')}</span>
                <span className="font-medium">
                  #{filters.rankMin || 1} - #{filters.rankMax || 100}
                </span>
              </div>
              <div className="px-2">
                <Slider
                  value={[filters.rankMin || 1, filters.rankMax || 100]}
                  onValueChange={([min, max]) => {
                    updateFilter('rankMin', min);
                    updateFilter('rankMax', max);
                  }}
                  min={1}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Top 1</span>
                <span>Top 100</span>
              </div>

              {/* 快捷选择 */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Top 10', min: 1, max: 10 },
                  { label: 'Top 30', min: 1, max: 30 },
                  { label: 'Top 50', min: 1, max: 50 },
                  { label: '30-50', min: 30, max: 50 },
                  { label: '50-100', min: 50, max: 100 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'text-xs',
                      filters.rankMin === preset.min &&
                        filters.rankMax === preset.max &&
                        'border-primary bg-primary/5'
                    )}
                    onClick={() => {
                      updateFilter('rankMin', preset.min);
                      updateFilter('rankMax', preset.max);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* 录取率 */}
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('labels.acceptanceRange')}</span>
                <span className="font-medium">
                  {filters.acceptanceMin || 0}% - {filters.acceptanceMax || 100}%
                </span>
              </div>
              <div className="px-2">
                <Slider
                  value={[filters.acceptanceMin || 0, filters.acceptanceMax || 100]}
                  onValueChange={([min, max]) => {
                    updateFilter('acceptanceMin', min);
                    updateFilter('acceptanceMax', max);
                  }}
                  min={0}
                  max={100}
                  step={5}
                  className="cursor-pointer"
                />
              </div>

              {/* 快捷选择 */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'veryHard', min: 0, max: 10 },
                  { key: 'hard', min: 10, max: 20 },
                  { key: 'medium', min: 20, max: 40 },
                  { key: 'easy', min: 40, max: 100 },
                ].map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'text-xs',
                      filters.acceptanceMin === preset.min &&
                        filters.acceptanceMax === preset.max &&
                        'border-primary bg-primary/5'
                    )}
                    onClick={() => {
                      updateFilter('acceptanceMin', preset.min);
                      updateFilter('acceptanceMax', preset.max);
                    }}
                  >
                    {t(`acceptancePresets.${preset.key}`)}
                  </Button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* 学费范围 */}
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('labels.annualTuition')}</span>
                <span className="font-medium">
                  ${filters.tuitionMin || 0}0k - ${filters.tuitionMax || 8}0k
                </span>
              </div>
              <div className="px-2">
                <Slider
                  value={[filters.tuitionMin || 0, filters.tuitionMax || 8]}
                  onValueChange={([min, max]) => {
                    updateFilter('tuitionMin', min);
                    updateFilter('tuitionMax', max);
                  }}
                  min={0}
                  max={8}
                  step={0.5}
                  className="cursor-pointer"
                />
              </div>

              {/* 快捷选择 */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'budget', min: 0, max: 3 },
                  { key: 'moderate', min: 3, max: 5 },
                  { key: 'high', min: 5, max: 7 },
                  { key: 'noLimit', min: 0, max: 8 },
                ].map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'text-xs',
                      filters.tuitionMin === preset.min &&
                        filters.tuitionMax === preset.max &&
                        'border-primary bg-primary/5'
                    )}
                    onClick={() => {
                      updateFilter('tuitionMin', preset.min);
                      updateFilter('tuitionMax', preset.max);
                    }}
                  >
                    {t(`tuitionPresets.${preset.key}`)}
                  </Button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* 学校类型 */}
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {format.number(filters.sizeMin || 0, 'standard')} -{' '}
                    {format.number(filters.sizeMax || 50000, 'standard')}
                  </span>
                </div>
                <div className="px-2">
                  <Slider
                    value={[filters.sizeMin || 0, filters.sizeMax || 50000]}
                    onValueChange={([min, max]) => {
                      updateFilter('sizeMin', min);
                      updateFilter('sizeMax', max);
                    }}
                    min={0}
                    max={50000}
                    step={1000}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </FilterSection>

          {/* 特殊条件 */}
          <FilterSection
            title={t('sections.special')}
            icon={Sparkles}
            expanded={expandedSections.includes('special')}
            onToggle={() => toggleSection('special')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    {t('specialConditions.testOptional')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('specialConditions.testOptionalDesc')}
                  </p>
                </div>
                <Switch
                  checked={filters.testOptional || false}
                  onCheckedChange={(checked) => updateFilter('testOptional', checked || undefined)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('specialConditions.needBlind')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('specialConditions.needBlindDesc')}
                  </p>
                </div>
                <Switch
                  checked={filters.needBlind || false}
                  onCheckedChange={(checked) => updateFilter('needBlind', checked || undefined)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('specialConditions.hasED')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('specialConditions.hasEDDesc')}
                  </p>
                </div>
                <Switch
                  checked={filters.hasEarlyDecision || false}
                  onCheckedChange={(checked) =>
                    updateFilter('hasEarlyDecision', checked || undefined)
                  }
                />
              </div>
            </div>
          </FilterSection>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
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

// 筛选器分组组件
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
        <button className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-medium text-sm">{title}</span>
            {badge && (
              <Badge variant="secondary" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-4 pb-2 px-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
