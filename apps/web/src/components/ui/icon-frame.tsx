'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconTone =
  | 'default'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'reach'
  | 'match'
  | 'safety';

type IconFrameSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const toneClasses: Record<IconTone, string> = {
  default: 'border-primary/15 bg-primary/7 text-primary',
  neutral: 'border-border bg-muted/55 text-muted-foreground',
  info: 'border-blue-500/15 bg-blue-500/7 text-blue-600 dark:text-blue-400',
  success: 'border-emerald-500/15 bg-emerald-500/7 text-emerald-600 dark:text-emerald-400',
  warning: 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-400',
  danger: 'border-rose-500/15 bg-rose-500/7 text-rose-600 dark:text-rose-400',
  reach: 'border-rose-500/15 bg-rose-500/7 text-rose-600 dark:text-rose-400',
  match: 'border-blue-500/15 bg-blue-500/7 text-blue-600 dark:text-blue-400',
  safety: 'border-emerald-500/15 bg-emerald-500/7 text-emerald-600 dark:text-emerald-400',
};

const toneTextClasses: Record<IconTone, string> = {
  default: 'text-primary',
  neutral: 'text-muted-foreground',
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  reach: 'text-rose-600 dark:text-rose-400',
  match: 'text-blue-600 dark:text-blue-400',
  safety: 'text-emerald-600 dark:text-emerald-400',
};

const frameSizeClasses: Record<IconFrameSize, string> = {
  xs: 'h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5',
  sm: 'h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4',
  md: 'h-10 w-10 rounded-lg [&>svg]:h-5 [&>svg]:w-5',
  lg: 'h-12 w-12 rounded-xl [&>svg]:h-6 [&>svg]:w-6',
  xl: 'h-16 w-16 rounded-xl [&>svg]:h-8 [&>svg]:w-8',
};

const inlineSizeClasses: Record<IconFrameSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
};

interface IconFrameProps {
  icon: LucideIcon;
  tone?: IconTone;
  size?: IconFrameSize;
  className?: string;
  iconClassName?: string;
  'aria-hidden'?: boolean;
  'aria-label'?: string;
}

export function IconFrame({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
  iconClassName,
  'aria-hidden': ariaHidden = true,
  'aria-label': ariaLabel,
}: IconFrameProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
        'transition-colors duration-150',
        toneClasses[tone],
        frameSizeClasses[size],
        className
      )}
      aria-hidden={ariaLabel ? undefined : ariaHidden}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <Icon strokeWidth={1.8} className={cn('shrink-0', iconClassName)} />
    </span>
  );
}

interface InlineIconProps {
  icon: LucideIcon;
  tone?: IconTone;
  size?: IconFrameSize;
  className?: string;
  'aria-hidden'?: boolean;
}

export function InlineIcon({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
  'aria-hidden': ariaHidden = true,
}: InlineIconProps) {
  return (
    <Icon
      strokeWidth={1.8}
      aria-hidden={ariaHidden}
      className={cn('shrink-0', toneTextClasses[tone], inlineSizeClasses[size], className)}
    />
  );
}
