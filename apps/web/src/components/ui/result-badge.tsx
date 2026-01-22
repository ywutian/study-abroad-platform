'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import {
  type AdmissionResultType,
  RESULT_STYLES,
  getResultBarColor,
  getResultBadgeClass,
} from '@/lib/utils/admission';

// ─── Result Badge ───────────────────────────────────────────────────────────

interface ResultBadgeProps {
  result: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const RESULT_ICONS: Record<AdmissionResultType, React.ElementType> = {
  ADMITTED: CheckCircle2,
  REJECTED: XCircle,
  WAITLISTED: Clock,
  DEFERRED: AlertCircle,
};

const SIZE_CLASSES = {
  sm: 'text-[11px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5',
};

const ICON_SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function ResultBadge({
  result,
  label,
  size = 'md',
  showIcon = false,
  className,
}: ResultBadgeProps) {
  const badgeClass = getResultBadgeClass(result);
  const Icon = RESULT_ICONS[result as AdmissionResultType];

  return (
    <Badge
      variant="outline"
      className={cn('font-medium gap-1 border', SIZE_CLASSES[size], badgeClass, className)}
    >
      {showIcon && Icon && <Icon className={ICON_SIZE_CLASSES[size]} />}
      {label}
    </Badge>
  );
}

// ─── Result Color Bar ───────────────────────────────────────────────────────

interface ResultBarProps {
  result: string;
  className?: string;
}

/**
 * A thin colored bar indicating admission result, used at top of cards
 */
export function ResultBar({ result, className }: ResultBarProps) {
  return (
    <div
      className={cn('h-1 transition-all group-hover:h-1.5', getResultBarColor(result), className)}
    />
  );
}

// Re-export utilities for convenience
export { RESULT_STYLES, getResultBarColor, getResultBadgeClass };
