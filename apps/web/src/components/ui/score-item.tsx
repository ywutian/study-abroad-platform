'use client';

import { cn } from '@/lib/utils';

// ─── Score Item ─────────────────────────────────────────────────────────────

interface ScoreItemProps {
  /** Label displayed above the score (e.g. "GPA", "SAT") */
  label: string;
  /** The score value to display (e.g. "3.8-3.9", "1450-1500") */
  value: string;
  /** Maximum possible value for calculating progress bar proportion */
  max?: string;
  /** Color theme for the progress bar */
  color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'teal';
  /** Display size variant */
  size?: 'sm' | 'md';
  /** Additional class name */
  className?: string;
}

const COLOR_BAR_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
};

const COLOR_BG_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-500/10',
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10',
  amber: 'bg-amber-500/10',
  rose: 'bg-rose-500/10',
  teal: 'bg-teal-500/10',
};

/**
 * Parse a numeric value from a range string like "3.8-3.9" or "1450-1500"
 * Takes the first (lower) number for proportion calculation
 */
function parseNumericValue(value: string): number | null {
  const match = value.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

export function ScoreItem({
  label,
  value,
  max,
  color = 'blue',
  size = 'md',
  className,
}: ScoreItemProps) {
  const numericValue = parseNumericValue(value);
  const numericMax = max ? parseFloat(max) : undefined;
  const percentage =
    numericValue !== null && numericMax
      ? Math.min((numericValue / numericMax) * 100, 100)
      : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            'text-overline text-muted-foreground',
            size === 'sm' ? 'text-[10px]' : 'text-xs'
          )}
        >
          {label}
        </span>
        <span className={cn('text-metric font-semibold', size === 'sm' ? 'text-base' : 'text-lg')}>
          {value}
        </span>
      </div>
      {percentage !== undefined && (
        <div className={cn('h-1.5 rounded-full overflow-hidden', COLOR_BG_CLASSES[color])}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              COLOR_BAR_CLASSES[color]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Compact Score Display ──────────────────────────────────────────────────

interface CompactScoreProps {
  label: string;
  value: string;
  className?: string;
}

/**
 * A compact score display for inline use (e.g. in detail panel headers)
 */
export function CompactScore({ label, value, className }: CompactScoreProps) {
  return (
    <div
      className={cn('px-3 py-2 rounded-lg bg-muted/50 border text-center min-w-[80px]', className)}
    >
      <p className="text-overline text-muted-foreground text-[10px] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-metric text-lg font-semibold">{value}</p>
    </div>
  );
}
