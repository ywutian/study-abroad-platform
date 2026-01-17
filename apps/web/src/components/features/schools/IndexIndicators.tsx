'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Smile, Utensils } from 'lucide-react';
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
  const { count, colorClass, label, hasData } = useMemo(() => {
    if (!grade) {
      return {
        count: 0,
        colorClass: 'text-muted-foreground/30',
        label: t('indices.noData'),
        hasData: false,
      };
    }

    const score = GRADE_SCORES[grade] ?? 0;
    const gradeLabel = GRADE_KEYS.includes(grade) ? t(`gradeLabels.${grade}`) : grade;

    // 计算显示图标数量 (1-3)
    let iconCount: number;
    let color: string;

    if (score >= 4) {
      iconCount = 3;
      color = 'text-emerald-500';
    } else if (score >= 3) {
      iconCount = 2;
      color = 'text-emerald-500';
    } else if (score >= 2) {
      iconCount = 2;
      color = 'text-amber-500';
    } else {
      iconCount = 1;
      color = 'text-red-500';
    }

    return {
      count: iconCount,
      colorClass: color,
      label: `${gradeLabel} (${grade})`,
      hasData: true,
    };
  }, [grade, t]);

  if (!hasData && !showEmpty) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  const maxIcons = 3;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 cursor-help">
            {[...Array(maxIcons)].map((_, i) => (
              <Shield
                key={i}
                className={cn(
                  iconSize,
                  'transition-colors',
                  i < count ? colorClass : 'text-muted-foreground/20'
                )}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            <span className="font-medium">{t('indices.safetyIndex')}:</span> {label}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const { count, colorClass, label, hasData } = useMemo(() => {
    if (!grade) {
      return {
        count: 0,
        colorClass: 'text-muted-foreground/30',
        label: t('indices.noData'),
        hasData: false,
      };
    }

    const score = GRADE_SCORES[grade] ?? 0;
    const gradeLabel = GRADE_KEYS.includes(grade) ? t(`gradeLabels.${grade}`) : grade;

    let iconCount: number;
    let color: string;

    if (score >= 4) {
      iconCount = 3;
      color = 'text-amber-500';
    } else if (score >= 3) {
      iconCount = 2;
      color = 'text-amber-500';
    } else if (score >= 2) {
      iconCount = 2;
      color = 'text-amber-400/70';
    } else {
      iconCount = 1;
      color = 'text-muted-foreground';
    }

    return {
      count: iconCount,
      colorClass: color,
      label: `${gradeLabel} (${grade})`,
      hasData: true,
    };
  }, [grade, t]);

  if (!hasData && !showEmpty) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  const maxIcons = 3;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 cursor-help">
            {[...Array(maxIcons)].map((_, i) => (
              <Smile
                key={i}
                className={cn(
                  iconSize,
                  'transition-colors',
                  i < count ? colorClass : 'text-muted-foreground/20'
                )}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            <span className="font-medium">{t('indices.happinessIndex')}:</span> {label}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 美食指数指示器
 */
export function FoodIndex({ grade, showEmpty = false, size = 'sm' }: IndexIndicatorProps) {
  const t = useTranslations('schools');
  const { count, colorClass, label, hasData } = useMemo(() => {
    if (!grade) {
      return {
        count: 0,
        colorClass: 'text-muted-foreground/30',
        label: t('indices.noData'),
        hasData: false,
      };
    }

    const score = GRADE_SCORES[grade] ?? 0;
    const gradeLabel = GRADE_KEYS.includes(grade) ? t(`gradeLabels.${grade}`) : grade;

    let iconCount: number;
    let color: string;

    if (score >= 4) {
      iconCount = 3;
      color = 'text-orange-500';
    } else if (score >= 3) {
      iconCount = 2;
      color = 'text-orange-500';
    } else if (score >= 2) {
      iconCount = 2;
      color = 'text-orange-400/70';
    } else {
      iconCount = 1;
      color = 'text-muted-foreground';
    }

    return {
      count: iconCount,
      colorClass: color,
      label: `${gradeLabel} (${grade})`,
      hasData: true,
    };
  }, [grade, t]);

  if (!hasData && !showEmpty) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  const maxIcons = 3;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5 cursor-help">
            {[...Array(maxIcons)].map((_, i) => (
              <Utensils
                key={i}
                className={cn(
                  iconSize,
                  'transition-colors',
                  i < count ? colorClass : 'text-muted-foreground/20'
                )}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            <span className="font-medium">{t('indices.foodIndex')}:</span> {label}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
        <Shield className="h-4 w-4 text-emerald-500" />
        <span className="text-xs">{t('indices.safetyIndex')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Smile className="h-4 w-4 text-amber-500" />
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
