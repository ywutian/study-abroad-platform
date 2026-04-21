'use client';

import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageHeaderColor = 'blue' | 'violet' | 'amber' | 'emerald' | 'rose' | 'slate' | 'indigo';
export type PageHeaderVariant = 'marketing' | 'entry' | 'tool' | 'ai' | 'community' | 'admin';
export type PageHeaderTone =
  | 'default'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ai'
  | 'reach'
  | 'target'
  | 'safety'
  | 'likely';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  variant?: PageHeaderVariant;
  tone?: PageHeaderTone;
  color?: PageHeaderColor;
  children?: ReactNode;
  actions?: ReactNode;
  stats?: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
    color?: string;
  }>;
  className?: string;
}

const variantConfig: Record<
  PageHeaderVariant,
  { shell: string; divider: string; statCard: string }
> = {
  marketing: {
    shell: 'relative mb-10 border-b pb-8',
    divider: 'border-[color:var(--ds-border)]',
    statCard: 'rounded-2xl border bg-[color:var(--ds-surface-subtle)] p-4',
  },
  entry: {
    shell: 'relative mb-8 border-b pb-6',
    divider: 'border-border',
    statCard: 'rounded-xl border border-border bg-card p-4',
  },
  tool: {
    shell: 'relative mb-8 border-b pb-6',
    divider: 'border-border',
    statCard: 'rounded-xl border border-border bg-card p-4',
  },
  ai: {
    shell: 'relative mb-8 rounded-3xl border p-6',
    divider: 'border-[color:var(--ds-border)] bg-[color:var(--ds-info-surface)]/85',
    statCard: 'rounded-2xl border border-[color:var(--ds-border)] bg-card/80 p-4',
  },
  community: {
    shell: 'relative mb-8 rounded-3xl border p-6',
    divider: 'border-border bg-muted/40',
    statCard: 'rounded-2xl border border-border bg-card/80 p-4',
  },
  admin: {
    shell: 'relative mb-8 rounded-2xl border p-6',
    divider: 'border-border bg-card',
    statCard: 'rounded-xl border border-border bg-muted/40 p-4',
  },
};

const toneConfig: Record<PageHeaderTone, { icon: string; iconBg: string; accent: string }> = {
  default: {
    icon: 'text-primary',
    iconBg: 'border-primary/20 bg-primary/10',
    accent: 'border-primary/30',
  },
  neutral: {
    icon: 'text-muted-foreground',
    iconBg: 'border-border bg-muted',
    accent: 'border-border',
  },
  info: {
    icon: 'text-primary',
    iconBg: 'border-primary/20 bg-primary/10',
    accent: 'border-primary/30',
  },
  success: {
    icon: 'text-success',
    iconBg: 'border-success/20 bg-success/10',
    accent: 'border-success/25',
  },
  warning: {
    icon: 'text-warning',
    iconBg: 'border-warning/20 bg-warning/10',
    accent: 'border-warning/25',
  },
  danger: {
    icon: 'text-destructive',
    iconBg: 'border-destructive/20 bg-destructive/10',
    accent: 'border-destructive/25',
  },
  ai: {
    icon: 'text-primary',
    iconBg: 'border-primary/20 bg-primary/10',
    accent: 'border-primary/25',
  },
  reach: {
    icon: 'text-[color:var(--ds-status-reach-fg)]',
    iconBg: 'border-[color:var(--ds-status-reach)]/20 bg-[color:var(--ds-status-reach-bg)]',
    accent: 'border-[color:var(--ds-status-reach)]/25',
  },
  target: {
    icon: 'text-[color:var(--ds-status-target-fg)]',
    iconBg: 'border-[color:var(--ds-status-target)]/20 bg-[color:var(--ds-status-target-bg)]',
    accent: 'border-[color:var(--ds-status-target)]/25',
  },
  safety: {
    icon: 'text-[color:var(--ds-status-safety-fg)]',
    iconBg: 'border-[color:var(--ds-status-safety)]/20 bg-[color:var(--ds-status-safety-bg)]',
    accent: 'border-[color:var(--ds-status-safety)]/25',
  },
  likely: {
    icon: 'text-[color:var(--ds-status-likely-fg)]',
    iconBg: 'border-[color:var(--ds-status-likely)]/20 bg-[color:var(--ds-status-likely-bg)]',
    accent: 'border-[color:var(--ds-status-likely)]/25',
  },
};

const colorToTone: Record<PageHeaderColor, PageHeaderTone> = {
  blue: 'info',
  indigo: 'info',
  violet: 'ai',
  amber: 'warning',
  emerald: 'success',
  rose: 'danger',
  slate: 'neutral',
};

function resolveVariant(variant?: PageHeaderVariant, color?: PageHeaderColor): PageHeaderVariant {
  if (variant) {
    return variant;
  }

  if (color === 'violet') {
    return 'ai';
  }

  if (color === 'slate') {
    return 'admin';
  }

  return 'tool';
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  variant,
  tone,
  color = 'blue',
  children,
  actions,
  stats,
  className,
}: PageHeaderProps) {
  const resolvedVariant = resolveVariant(variant, color);
  const shell = variantConfig[resolvedVariant];
  const resolvedTone = tone ?? colorToTone[color];
  const accent = toneConfig[resolvedTone];

  return (
    <div className={cn(shell.shell, shell.divider, className)}>
      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {Icon ? (
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-xl border',
                    accent.iconBg,
                    accent.icon
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
              ) : null}
              <div>
                <h1 className="text-title">{title}</h1>
                {description ? (
                  <p className="mt-1 max-w-3xl text-body-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>
          </div>

          {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
        </div>

        {stats && stats.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className={cn(shell.statCard, accent.accent)}>
                <div
                  className={cn(
                    'mb-1 flex items-center gap-2',
                    stat.color ?? 'text-muted-foreground'
                  )}
                >
                  {stat.icon ? <stat.icon className="h-4 w-4" /> : null}
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className={cn('text-2xl font-semibold', stat.color ?? '')}>{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}

interface SimplePageHeaderProps {
  title: string;
  description?: string;
  variant?: PageHeaderVariant;
  className?: string;
}

export function SimplePageHeader({
  title,
  description,
  variant = 'tool',
  className,
}: SimplePageHeaderProps) {
  const shell = variantConfig[variant];

  return (
    <div className={cn(shell.shell, shell.divider, className)}>
      <h1 className="text-title">{title}</h1>
      {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
