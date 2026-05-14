'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, UsersRound, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// 评分等级映射到分数 (0-5)
const GRADE_SCORES: Record<string, number> = {
  'A+': 5,
  A: 4,
  'A-': 4,
  'B+': 3,
  B: 3,
  'B-': 2,
  'C+': 2,
  C: 1,
  'C-': 1,
  'D+': 1,
  D: 0,
  'D-': 0,
  F: 0,
};

const GRADE_KEYS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

interface IndexIndicatorProps {
  grade?: string | null;
  showEmpty?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getGradeTone(score: number) {
  if (score >= 4)
    return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300';
  if (score >= 3) return 'border-blue-500/20 bg-blue-500/8 text-blue-700 dark:text-blue-300';
  if (score >= 2) return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-300';
}

function GradeIndexChip({
  grade,
  showEmpty,
  size,
  icon: Icon,
  label,
  shortLabel,
}: IndexIndicatorProps & { icon: LucideIcon; label: string; shortLabel: string }) {
  const t = useTranslations('schools');
  const { tone, displayLabel, hasData } = useMemo(() => {
    if (!grade) {
      return {
        tone: 'border-border bg-muted/50 text-muted-foreground',
        displayLabel: t('indices.noData'),
        hasData: false,
      };
    }

    const score = GRADE_SCORES[grade] ?? 0;
    const gradeLabel = GRADE_KEYS.includes(grade) ? t(`gradeLabels.${grade}`) : grade;

    return {
      tone: getGradeTone(score),
      displayLabel: `${gradeLabel} (${grade})`,
      hasData: true,
    };
  }, [grade, t]);

  if (!hasData && !showEmpty) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex cursor-help items-center border font-medium',
              size === 'lg'
                ? 'h-8 gap-1.5 rounded-lg px-2.5 text-xs'
                : size === 'md'
                  ? 'h-7 gap-1.5 rounded-md px-2 text-xs'
                  : 'h-6 gap-1 rounded-md px-1.5 text-2xs',
              tone
            )}
          >
            <Icon strokeWidth={1.8} className={cn(size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
            <span>{shortLabel}</span>
            <span className="tabular-nums">{grade ?? '—'}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            <span className="font-medium">{label}:</span> {displayLabel}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 安全指数指示器
 *
 * 显示逻辑：
 * - A+/A: 3个绿色盾牌 (很安全)
 * - A-/B+: 2个绿色盾牌 (安全)
 * - B/B-: 2个黄色盾牌 (一般)
 * - C+及以下: 1个红色盾牌 (注意)
 */
export function SafetyIndex({ grade, showEmpty = false, size = 'sm' }: IndexIndicatorProps) {
  const t = useTranslations('schools');
  return (
    <GradeIndexChip
      grade={grade}
      showEmpty={showEmpty}
      size={size}
      icon={ShieldCheck}
      label={t('indices.safetyIndex')}
      shortLabel={t('indices.safetyShort')}
    />
  );
}

/**
 * 幸福指数指示器
 *
 * 显示逻辑：
 * - A+/A: 3个黄色笑脸 (非常幸福)
 * - A-/B+: 2个黄色笑脸 (幸福)
 * - B/B-: 2个灰黄笑脸 (一般)
 * - C+及以下: 1个灰色笑脸 (较差)
 */
export function HappinessIndex({ grade, showEmpty = false, size = 'sm' }: IndexIndicatorProps) {
  const t = useTranslations('schools');
  return (
    <GradeIndexChip
      grade={grade}
      showEmpty={showEmpty}
      size={size}
      icon={UsersRound}
      label={t('indices.happinessIndex')}
      shortLabel={t('indices.lifeShort')}
    />
  );
}

/**
 * 美食指数指示器
 */
export function FoodIndex({ grade, showEmpty = false, size = 'sm' }: IndexIndicatorProps) {
  const t = useTranslations('schools');
  return (
    <GradeIndexChip
      grade={grade}
      showEmpty={showEmpty}
      size={size}
      icon={Utensils}
      label={t('indices.foodIndex')}
      shortLabel={t('indices.foodShort')}
    />
  );
}

/**
 * 指数组 - 显示所有指数
 */
interface IndexGroupProps {
  safetyGrade?: string | null;
  lifeGrade?: string | null;
  foodGrade?: string | null;
  showEmpty?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function IndexGroup({
  safetyGrade,
  lifeGrade,
  foodGrade,
  showEmpty = false,
  size = 'sm',
  className,
}: IndexGroupProps) {
  const hasAnyData = safetyGrade || lifeGrade || foodGrade;

  if (!hasAnyData && !showEmpty) return null;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SafetyIndex grade={safetyGrade} showEmpty={showEmpty} size={size} />
      <HappinessIndex grade={lifeGrade} showEmpty={showEmpty} size={size} />
      <FoodIndex grade={foodGrade} showEmpty={showEmpty} size={size} />
    </div>
  );
}

/**
 * 指数图例组件
 */
interface IndexLegendProps {
  className?: string;
}

export function IndexLegend({ className }: IndexLegendProps) {
  const t = useTranslations('schools');
  return (
    <div
      className={cn('flex flex-wrap items-center gap-4 text-sm text-muted-foreground', className)}
    >
      <span className="font-medium">{t('indices.legend')}:</span>
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span className="text-xs">{t('indices.safetyIndex')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <UsersRound className="h-4 w-4 text-blue-500" />
        <span className="text-xs">{t('indices.happinessIndex')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Utensils className="h-4 w-4 text-orange-500" />
        <span className="text-xs">{t('indices.foodIndex')}</span>
      </div>
      <span className="text-xs text-muted-foreground/70">{t('indices.moreIsBetter')}</span>
    </div>
  );
}
