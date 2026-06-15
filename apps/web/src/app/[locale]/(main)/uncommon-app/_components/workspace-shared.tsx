'use client';

import { ArrowRight, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { TFunction } from './types';
import type {
  HealthCheck,
  SchoolApplicationRow,
  WorkspaceAction,
} from './application-workspace-model';

export function WorkspaceActionButton({
  t,
  action,
  onAction,
  isBusy,
  size = 'sm',
  variant = 'default',
  className,
  labelKey,
}: {
  t: TFunction;
  action: WorkspaceAction;
  onAction: (action: WorkspaceAction) => void;
  isBusy: boolean;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
  className?: string;
  labelKey?: string;
}) {
  const label = t(labelKey ?? `workspace.actions.${action.id}`);
  const content = (
    <>
      {isBusy && action.intent !== 'navigate' ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4" />
      )}
      {label}
    </>
  );

  if (action.intent === 'navigate' && action.href) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() => onAction(action)}
      disabled={isBusy && action.intent !== 'navigate'}
    >
      {content}
    </Button>
  );
}

export function StatusChip({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  status: 'good' | 'warning' | 'risk';
}) {
  return (
    <div className={cn('rounded-[var(--theme-radius-card)] border p-2.5', statusBg(status))}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', statusText(status))} />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

export function actionFromNextStep(step: SchoolApplicationRow['nextStep']): WorkspaceAction {
  switch (step) {
    case 'sync-requirements':
      return { id: 'sync-requirements', intent: 'sync' };
    case 'review-deadlines':
    case 'view-timeline':
      return { id: 'review-deadlines', href: '/timeline', intent: 'navigate' };
    case 'write-essays':
      return { id: 'sync-requirements', href: '/essays', intent: 'navigate' };
    case 'run-prediction':
      return { id: 'generate-advice', href: '/prediction', intent: 'navigate' };
    case 'complete-profile':
      return { id: 'complete-profile', href: '/profile', intent: 'navigate' };
    case 'add-schools':
    case 'add-safety':
    case 'generate-advice':
      return {
        id: step,
        href: step === 'generate-advice' ? undefined : '/schools',
        intent: step === 'generate-advice' ? 'analysis' : 'navigate',
      };
  }
}

export function deadlineLabel(t: TFunction, row: SchoolApplicationRow) {
  if (!row.deadline || row.daysUntil === null) return t('workspace.schoolBoard.deadlineMissing');
  return `${formatDate(row.deadline)} · ${deadlineShortLabel(t, row)}`;
}

export function deadlineShortLabel(t: TFunction, row: SchoolApplicationRow) {
  if (row.daysUntil === null) return t('workspace.schoolBoard.deadlineMissing');
  if (row.daysUntil < 0)
    return t('workspace.schoolBoard.overdue', { days: Math.abs(row.daysUntil) });
  if (row.daysUntil === 0) return t('workspace.schoolBoard.dueToday');
  if (row.daysUntil <= 7) return t('workspace.schoolBoard.dueSoon', { days: row.daysUntil });
  if (row.daysUntil <= 30) return t('workspace.schoolBoard.dueMonth', { days: row.daysUntil });
  return t('workspace.schoolBoard.dueLater', { days: row.daysUntil });
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(date)
  );
}

export function healthDescription(t: TFunction, check: HealthCheck) {
  return t(`workspace.health.${check.id}.${check.status}`, check.meta);
}

export function statusBorder(status: 'good' | 'warning' | 'risk') {
  if (status === 'good') return 'border-success/25';
  if (status === 'risk') return 'border-destructive/30';
  return 'border-warning/30';
}

export function statusBg(status: 'good' | 'warning' | 'risk') {
  if (status === 'good') return 'border-success/25 bg-success/5';
  if (status === 'risk') return 'border-destructive/30 bg-destructive/5';
  return 'border-warning/30 bg-warning/5';
}

export function statusText(status: 'good' | 'warning' | 'risk') {
  if (status === 'good') return 'text-success';
  if (status === 'risk') return 'text-destructive';
  return 'text-warning';
}

export function badgeVariant(
  status: 'good' | 'warning' | 'risk'
): 'success' | 'warning' | 'destructive' {
  if (status === 'good') return 'success';
  if (status === 'risk') return 'destructive';
  return 'warning';
}
