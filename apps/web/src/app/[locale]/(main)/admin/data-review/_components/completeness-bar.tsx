'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CompletenessBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function CompletenessBar({ value, className, showLabel = true }: CompletenessBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  const barColor =
    pct >= 70
      ? 'bg-emerald-500 dark:bg-emerald-400'
      : pct >= 40
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-500 dark:bg-rose-400';

  const textColor =
    pct >= 70
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            {showLabel && (
              <span className={cn('text-xs font-mono tabular-nums', textColor)}>{pct}%</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Data completeness: {pct}% of optional fields filled</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
