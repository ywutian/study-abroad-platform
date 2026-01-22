'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const countBadgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border-transparent font-bold text-white transition-colors duration-150',
  {
    variants: {
      variant: {
        primary: 'bg-blue-500',
        destructive: 'bg-red-500',
      },
      size: {
        sm: 'h-4 min-w-[16px] px-1 text-[10px]',
        md: 'h-5 min-w-[20px] px-1.5 text-2xs',
        lg: 'h-6 min-w-[24px] px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface CountBadgeProps
  extends Omit<React.ComponentProps<'span'>, 'children'>, VariantProps<typeof countBadgeVariants> {
  /** 未读/计数数值 */
  count: number;
  /** 最大显示值，超出显示 max+ (默认 99) */
  max?: number;
  /** 仅显示圆点指示器，不显示数字 */
  dot?: boolean;
  /** 绝对定位到父容器右上角 */
  absolute?: boolean;
}

const dotSizeClasses = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
} as const;

function CountBadge({
  count,
  max = 99,
  dot = false,
  absolute = false,
  variant,
  size = 'md',
  className,
  ...props
}: CountBadgeProps) {
  const t = useTranslations('ui.countBadge');

  if (count <= 0) return null;

  const displayValue = count > max ? `${max}+` : count;
  const ariaLabel = props['aria-label'] ?? t('unread', { count });

  // 圆点模式：仅显示小圆点
  if (dot) {
    return (
      <span
        role="status"
        aria-label={ariaLabel}
        className={cn(
          'rounded-full',
          dotSizeClasses[size ?? 'md'],
          variant === 'destructive' ? 'bg-red-500' : 'bg-blue-500',
          absolute && 'absolute -top-0.5 -right-0.5',
          className
        )}
        {...props}
      />
    );
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        countBadgeVariants({ variant, size }),
        absolute && 'absolute -top-1 -right-1',
        className
      )}
      {...props}
    >
      {displayValue}
    </span>
  );
}

export { CountBadge, countBadgeVariants };
