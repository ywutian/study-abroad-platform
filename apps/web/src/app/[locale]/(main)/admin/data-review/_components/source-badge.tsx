'use client';

import { Badge } from '@/components/ui/badge';
import { Globe, FileText, User, MessageSquare } from 'lucide-react';
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
