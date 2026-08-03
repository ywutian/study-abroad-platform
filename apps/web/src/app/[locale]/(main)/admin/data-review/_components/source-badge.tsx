'use client';

import { Badge } from '@/components/ui/badge';
import { Globe, FileText, User, MessageSquare, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    label: string;
    className: string;
  }
> = {
  reddit: {
    icon: MessageSquare,
    label: 'Reddit',
    className:
      'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  },
  csv_import: {
    icon: FileText,
    label: 'CSV',
    className:
      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  user_submit: {
    icon: User,
    label: 'User',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  manual: {
    icon: User,
    label: 'Manual',
    className:
      'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  },
  // Auto-generated when a student's self-reported prediction outcome is
  // verified — not something they submitted for publication. Distinct colour
  // so a reviewer can tell at a glance that the student never wrote this row.
  outcome_self_report: {
    // A check, not a wand: this row is derived from a *verified* outcome, so
    // the badge should say "checked", not "generated". The icon it replaced was
    // on check-icon-language's banned list — and reading as AI-generated was
    // exactly the wrong signal for a row a student did not write.
    icon: CircleCheck,
    label: 'Outcome',
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
};

const DEFAULT_CONFIG = {
  icon: Globe,
  label: 'Other',
  className: 'bg-muted text-muted-foreground',
};

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source] || { ...DEFAULT_CONFIG, label: source || 'Unknown' };
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 text-xs font-medium', config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
