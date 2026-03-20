'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QualityScoreBadgeProps {
  score: number | null | undefined;
  className?: string;
}

export function QualityScoreBadge({ score, className }: QualityScoreBadgeProps) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;

  const rounded = Math.round(score);

  let variant: 'default' | 'secondary' | 'destructive' = 'default';
  let colorClass = '';

  if (rounded >= 80) {
    variant = 'default';
    colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  } else if (rounded >= 50) {
    variant = 'secondary';
    colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  } else {
    variant = 'destructive';
    colorClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }

  return (
    <Badge variant={variant} className={cn('font-mono text-xs', colorClass, className)}>
      {rounded}
    </Badge>
  );
}
