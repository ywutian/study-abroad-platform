'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ContextualHelp } from '@/components/ui/contextual-help';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';

const COLOR_CLASSES = {
  blue: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    border: 'border-t-blue-500',
  },
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    border: 'border-t-emerald-500',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    border: 'border-t-amber-500',
  },
  rose: {
    icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    border: 'border-t-rose-500',
  },
  violet: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    border: 'border-t-violet-500',
  },
} as const;

interface AdminStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: keyof typeof COLOR_CLASSES;
  trend?: { value: number; label: string };
  href?: string;
  help?: { title: string; description: string };
  className?: string;
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  href,
  help,
  className,
}: AdminStatCardProps) {
  const colors = COLOR_CLASSES[color];

  const content = (
    <Card
      className={cn(
        'border-t-2',
        colors.border,
        href && 'hover:shadow-md transition-shadow cursor-pointer',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              {help && (
                <ContextualHelp
                  variant="info"
                  title={help.title}
                  description={help.description}
                  size="sm"
                />
              )}
            </div>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <p
                className={cn(
                  'text-xs',
                  trend.value >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value} {trend.label}
              </p>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', colors.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
