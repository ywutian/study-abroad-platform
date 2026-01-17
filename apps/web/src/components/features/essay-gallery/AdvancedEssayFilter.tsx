'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  SlidersHorizontal,
  FileText,
  Trophy,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  GraduationCap,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface EssayFilters {
  type?: 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
  promptNumber?: number;
  result?: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  rankMin?: number;
  rankMax?: number;
  isVerified?: boolean;
}

interface AdvancedEssayFilterProps {
  filters: EssayFilters;
  onChange: (filters: EssayFilters) => void;
  onReset: () => void;
  activeCount: number;
}

// Common App 7 个题目
// These labels will be resolved via translations at render time
const COMMON_APP_PROMPT_NUMBERS = [1, 2, 3, 4, 5, 6, 7];
const UC_PIQ_NUMBERS = [1, 2, 3, 4];

export function AdvancedEssayFilter({
  filters,
  onChange,
  onReset,
  activeCount,
}: AdvancedEssayFilterProps) {
  const t = useTranslations('essayGallery');
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['type', 'ranking']);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const updateFilter = <K extends keyof EssayFilters>(key: K, value: EssayFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const setType = (type: EssayFilters['type']) => {
    // 切换类型时清除 promptNumber
    onChange({ ...filters, type, promptNumber: undefined });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <SlidersHorizontal className="h-4 w-4" />
          {t('filter.advanced')}
          {activeCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-amber-500 text-white text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t('filter.advancedTitle')}
          </SheetTitle>
          <SheetDescription>{t('filter.advancedDesc')}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* 文书类型选择 */}
          <FilterSection
            title={t('filter.essayType')}
            icon={FileText}
            expanded={expandedSections.includes('type')}
            onToggle={() => toggleSection('type')}
            badge={filters.type}
          >
            <div className="space-y-4">
              {/* 类型按钮 */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value: 'COMMON_APP',
                    label: 'Common App',
                    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                  },
                  {
                    value: 'UC',
                    label: t('filter.ucEssays'),
                    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                  },
                  {
                    value: 'SUPPLEMENTAL',
                    label: t('filter.supplementalEssays'),
                    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                  },
                  {
                    value: 'WHY_SCHOOL',
                    label: 'Why School',
                    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                  },
                ].map((item) => (
                  <Button
                    key={item.value}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'justify-start h-9',
                      filters.type === item.value && item.color + ' border'
                    )}
                    onClick={() =>
                      setType(filters.type === item.value ? undefined : (item.value as any))
                    }
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {/* Common App 题号选择 */}
              {filters.type === 'COMMON_APP' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label className="text-xs text-muted-foreground">
                    {t('filter.selectPrompt')}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_APP_PROMPT_NUMBERS.map((num) => (
                      <Button
                        key={num}
                        variant={filters.promptNumber === num ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-8 px-3',
                          filters.promptNumber === num && 'bg-blue-500 hover:bg-blue-600'
                        )}
                        onClick={() =>
                          updateFilter(
                            'promptNumber',
                            filters.promptNumber === num ? undefined : num
                          )
                        }
                        title={t(`filter.commonAppPrompts.${num}`)}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  {filters.promptNumber && (
                    <p className="text-xs text-muted-foreground">
                      {t('filter.promptLabel', {
                        number: filters.promptNumber,
                        label: t(`filter.commonAppPrompts.${filters.promptNumber}`),
                      })}
                    </p>
                  )}
                </motion.div>
              )}

              {/* UC PIQ 选择 */}
              {filters.type === 'UC' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label className="text-xs text-muted-foreground">{t('filter.selectPIQ')}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {UC_PIQ_NUMBERS.map((num) => (
                      <Button
                        key={num}
                        variant={filters.promptNumber === num ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-8 px-3',
                          filters.promptNumber === num && 'bg-amber-500 hover:bg-amber-600'
                        )}
                        onClick={() =>
                          updateFilter(
                            'promptNumber',
                            filters.promptNumber === num ? undefined : num
                          )
                        }
                      >
                        PIQ {num}
                      </Button>
                    ))}
                  </div>
                  {filters.promptNumber && (
                    <p className="text-xs text-muted-foreground">
                      {t('filter.piqLabel', {
                        number: filters.promptNumber,
                        label: t(`filter.ucPIQs.${filters.promptNumber}`),
                      })}
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </FilterSection>

          {/* 学校排名范围 */}
          <FilterSection
            title={t('filter.schoolRanking')}
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
                <span className="text-muted-foreground">{t('filter.usNewsRanking')}</span>
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
                  { label: 'Top 20', min: 1, max: 20 },
                  { label: 'Top 30', min: 1, max: 30 },
                  { label: 'Top 50', min: 1, max: 50 },
                  { label: '30-50', min: 30, max: 50 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className={cn(
                      'text-xs',
                      filters.rankMin === preset.min &&
                        filters.rankMax === preset.max &&
                        'border-amber-500 bg-amber-500/5'
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

          {/* 录取结果 */}
          <FilterSection
            title={t('filter.admissionResult')}
            icon={GraduationCap}
            expanded={expandedSections.includes('result')}
            onToggle={() => toggleSection('result')}
            badge={filters.result}
          >
            <div className="flex flex-wrap gap-2">
              {[
                {
                  value: 'ADMITTED',
                  label: t('filter.admitted'),
                  color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                },
                {
                  value: 'WAITLISTED',
                  label: 'Waitlist',
                  color: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                },
                {
                  value: 'REJECTED',
                  label: t('filter.rejected'),
                  color: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
                },
                {
                  value: 'DEFERRED',
                  label: t('filter.deferred'),
                  color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
                },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant="outline"
                  size="sm"
                  className={cn('h-9', filters.result === item.value && item.color)}
                  onClick={() =>
                    updateFilter(
                      'result',
                      filters.result === item.value ? undefined : (item.value as any)
                    )
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </FilterSection>

          {/* 其他条件 */}
          <FilterSection
            title={t('filter.otherConditions')}
            icon={Sparkles}
            expanded={expandedSections.includes('other')}
            onToggle={() => toggleSection('other')}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{t('filter.verifiedOnly')}</Label>
                <p className="text-xs text-muted-foreground">{t('filter.verifiedOnlyDesc')}</p>
              </div>
              <Switch
                checked={filters.isVerified || false}
                onCheckedChange={(checked) => updateFilter('isVerified', checked || undefined)}
              />
            </div>
          </FilterSection>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onReset} className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            {t('filter.reset')}
          </Button>
          <Button
            onClick={() => setOpen(false)}
            className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('filter.apply')}
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
