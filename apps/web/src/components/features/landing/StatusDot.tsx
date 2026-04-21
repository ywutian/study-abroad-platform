'use client';

import { cn } from '@/lib/utils';

type StatusDotProps = {
  status: 'success' | 'warning' | 'info' | 'danger' | 'ai';
  pulse?: boolean;
  className?: string;
};

export function StatusDot({ status, pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-flex h-2 w-2 rounded-full',
        pulse && 'animate-pulse',
        status === 'success' && 'bg-success',
        status === 'warning' && 'bg-warning',
        status === 'info' && 'bg-[color:var(--ds-status-likely)]',
        status === 'danger' && 'bg-destructive',
        status === 'ai' && 'bg-primary',
        className
      )}
    />
  );
}

export type { StatusDotProps };
