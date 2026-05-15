'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  ClipboardList,
  FileText,
  Gauge,
  ListChecks,
  School,
  User,
} from 'lucide-react';
import type {
  DashboardPriorityItem,
  DashboardReadinessStatus,
  DashboardSeverity,
  DashboardWorkbench,
} from './dashboard-workbench-model';

interface DashboardCommandCenterProps {
  workbench: DashboardWorkbench;
  completingTaskId?: string | null;
  onCompleteTask: (item: DashboardPriorityItem) => void;
}

const severityMeta: Record<
  DashboardSeverity,
  {
    badge: 'destructive' | 'warning' | 'outline' | 'success';
    dot: string;
    text: string;
    border: string;
  }
> = {
  critical: {
    badge: 'destructive',
    dot: 'bg-destructive',
    text: 'text-destructive',
    border: 'border-destructive/25 bg-destructive/5',
  },
  warning: {
    badge: 'warning',
    dot: 'bg-warning',
    text: 'text-warning',
    border: 'border-warning/25 bg-warning/5',
  },
  normal: {
    badge: 'outline',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    border: 'border-border bg-[color:var(--theme-control-bg)]',
  },
  success: {
    badge: 'success',
    dot: 'bg-success',
    text: 'text-success',
    border: 'border-success/25 bg-success/5',
  },
};

const statusMeta: Record<DashboardReadinessStatus, { className: string }> = {
  blocked: { className: 'border-destructive/25 bg-destructive/5' },
  attention: { className: 'border-warning/25 bg-warning/5' },
  ready: { className: 'border-success/25 bg-success/5' },
};

function PriorityKindIcon({
  kind,
  className,
}: {
  kind: DashboardPriorityItem['kind'];
  className?: string;
}) {
  switch (kind) {
    case 'profile':
      return <User className={className} />;
    case 'school-list':
      return <School className={className} />;
    case 'timeline':
    case 'deadline':
      return <CalendarClock className={className} />;
    case 'timeline-task':
      return <ListChecks className={className} />;
    case 'essay':
      return <FileText className={className} />;
    case 'prediction':
      return <Gauge className={className} />;
  }
}

export function DashboardCommandCenter({
  workbench,
  completingTaskId,
  onCompleteTask,
}: DashboardCommandCenterProps) {
  const t = useTranslations('dashboard.workbench');
  const topAction = workbench.priorityQueue[0];
  const topSeverity = topAction ? severityMeta[topAction.severity] : severityMeta.normal;
  const formatDeadline = (daysLeft: number) => {
    if (daysLeft < 0) return t('deadlineOverdue', { count: Math.abs(daysLeft) });
    if (daysLeft === 0) return t('deadlineToday');
    return t('deadlineDays', { count: daysLeft });
  };

  return (
    <Card className="overflow-hidden rounded-[var(--theme-radius-card)] border-border bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]">
      <CardContent className="p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 border-b border-border p-4 sm:p-5 xl:border-b-0 xl:border-r">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t('label')}</Badge>
                  <span className="text-xs text-muted-foreground">{t('rhythm')}</span>
                </div>
                <div className="mt-4 flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--theme-radius-card)] border',
                      topSeverity.border
                    )}
                  >
                    {topAction ? (
                      <PriorityKindIcon kind={topAction.kind} className="h-5 w-5" />
                    ) : (
                      <ClipboardList className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">
                      {topAction?.title ?? t('emptyTitle')}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {topAction?.description ?? t('emptyDescription')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {topAction ? (
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={topAction.href}>
                      {t('primaryCta')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label={t('score')} value={`${workbench.readiness.score}%`} />
              <MetricTile label={t('due7')} value={workbench.metrics.due7} />
              <MetricTile label={t('due30')} value={workbench.metrics.due30} />
              <MetricTile
                label={t('timelineGaps')}
                value={workbench.metrics.missingTimelineCount}
                tone={workbench.metrics.missingTimelineCount > 0 ? 'warning' : 'success'}
              />
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t('readiness')}</h3>
                <Badge
                  variant={
                    workbench.readiness.status === 'ready'
                      ? 'success'
                      : workbench.readiness.status === 'attention'
                        ? 'warning'
                        : 'destructive'
                  }
                >
                  {t(`status.${workbench.readiness.status}`)}
                </Badge>
              </div>
              <Progress value={workbench.readiness.score} className="h-1.5" />
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {workbench.readiness.items.map((item) => {
                  const meta = statusMeta[item.status];
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        'block rounded-[var(--theme-radius-card)] border p-3 transition-colors hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]',
                        meta.className
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.label}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {item.value}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t('priorityQueue')}</h3>
              <Badge variant={workbench.metrics.balancedSchoolList ? 'success' : 'warning'}>
                {workbench.metrics.balancedSchoolList ? t('balanced') : t('needsBalance')}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              {workbench.priorityQueue.map((item) => {
                const meta = severityMeta[item.severity];
                const isCompleting =
                  completingTaskId === item.id ||
                  completingTaskId === item.id.replace(/^task-/, '');
                return (
                  <div
                    key={item.id}
                    className={cn('rounded-[var(--theme-radius-card)] border p-3', meta.border)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-card-bg)]">
                        <PriorityKindIcon kind={item.kind} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                          <p className="min-w-0 flex-1 text-sm font-medium">{item.title}</p>
                          <Badge variant={meta.badge}>{t(`severity.${item.severity}`)}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={item.href}>
                              {t('open')}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {item.mutation?.type === 'timeline-task-toggle' ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-busy={isCompleting}
                              disabled={isCompleting}
                              onClick={() => onCompleteTask(item)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t('completeTask')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t('deadlineStream')}</h3>
                <Link href="/timeline" className="text-xs font-medium text-primary">
                  {t('viewTimeline')}
                </Link>
              </div>
              {workbench.deadlineStream.length > 0 ? (
                <div className="space-y-2">
                  {workbench.deadlineStream.slice(0, 5).map((item) => {
                    const meta = severityMeta[item.severity];
                    return (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        className="flex items-center gap-3 rounded-[var(--theme-radius-card)] border border-border px-3 py-2 transition-colors hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]"
                      >
                        <CircleAlert className={cn('h-4 w-4 shrink-0', meta.text)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {formatDeadline(item.daysLeft)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[var(--theme-radius-card)] border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('noDeadlines')}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string | number;
  tone?: 'normal' | 'warning' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--theme-radius-card)] border px-3 py-2.5',
        tone === 'warning'
          ? 'border-warning/25 bg-warning/5'
          : tone === 'success'
            ? 'border-success/25 bg-success/5'
            : 'border-border bg-[color:var(--theme-control-bg)]'
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
