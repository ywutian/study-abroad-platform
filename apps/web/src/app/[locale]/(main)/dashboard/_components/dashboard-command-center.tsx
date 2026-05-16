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
  Sparkles,
  TrendingUp,
  User,
} from 'lucide-react';

import { DashboardPipelineStrip } from './dashboard-pipeline-strip';
import { DashboardQuickAddSchool } from './dashboard-quick-add-school';
import {
  getProfileGrade,
  type DashboardPriorityItem,
  type DashboardReadinessStatus,
  type DashboardSeverity,
  type DashboardWorkbench,
} from './dashboard-workbench-model';

interface DashboardCommandCenterProps {
  workbench: DashboardWorkbench;
  completingTaskId?: string | null;
  onCompleteTask: (item: DashboardPriorityItem) => void;
  /**
   * Raw profile completeness percentage (0-100). Used to derive the
   * Profile Grade badge shown on the readiness item and to detect the
   * 0% empty-state onboarding scenario.
   */
  completeness: number;
  /** Tier breakdown shown as badges on the schools readiness item. */
  schoolTiers: { reach: number; target: number; safety: number };
  /** Total school count, used to detect the 0%/0-schools empty state. */
  schoolCount: number;
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
  completeness,
  schoolTiers,
  schoolCount,
}: DashboardCommandCenterProps) {
  const t = useTranslations('dashboard.workbench');
  const tCenter = useTranslations('dashboard.commandCenter');
  const tStats = useTranslations('dashboard.stats');
  const topAction = workbench.priorityQueue[0];
  const topSeverity = topAction ? severityMeta[topAction.severity] : severityMeta.normal;
  const grade = getProfileGrade(completeness);
  // 2026-05: when a brand-new user has zero profile data AND zero schools,
  // showing "0%" everywhere is demoralizing. Switch the hero region to a
  // welcoming onboarding card instead. The right column (priority queue +
  // deadline stream) keeps rendering normally so the page never feels empty.
  const isEmptyOnboarding = completeness === 0 && schoolCount === 0;
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
                {isEmptyOnboarding ? (
                  <div className="mt-4 flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--theme-radius-card)] border border-primary/25 bg-primary/5">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">
                        {tCenter('onboarding.title')}
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {tCenter('onboarding.description')}
                      </p>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>

              <div className="shrink-0">
                {isEmptyOnboarding ? (
                  <Button asChild className="w-full sm:w-auto">
                    <Link href="/profile">
                      {tCenter('onboarding.cta')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : topAction ? (
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={topAction.href}>
                      {t('primaryCta')}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{t('readiness')}</h3>
                <div className="flex items-center gap-2">
                  {/* 2026-05: Quick Add School inline. Compresses the
                      previous 5-click "open schools page → search →
                      detail → add → confirm round" flow into 2 clicks
                      (open popover → click result). Lives in the
                      readiness header (not on the schools row) to avoid
                      nesting a button inside the row's Link. */}
                  <DashboardQuickAddSchool />
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {workbench.readiness.score}
                    <span className="text-xs">/100</span>
                  </span>
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
              </div>
              <Progress value={workbench.readiness.score} className="h-1.5" />
              <p className="mt-1.5 text-xs text-muted-foreground">{tCenter('contributionHint')}</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {workbench.readiness.items.map((item) => {
                  const meta = statusMeta[item.status];
                  // 2026-05: When the prediction row is in the "attention"
                  // state (eligible to run but hasn't been run yet), route
                  // the click straight into auto-run mode so a single click
                  // from the dashboard kicks off the prediction. This
                  // collapses the previous 4-click flow (open → select →
                  // run → wait) into 1 click.
                  const href =
                    item.key === 'prediction' && item.status === 'attention'
                      ? `${item.href}?autorun=1`
                      : item.href;
                  return (
                    <Link
                      key={item.key}
                      href={href}
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
                          {/* Action hint for prediction row in attention state.
                              Communicates that clicking actually runs, not just
                              navigates. */}
                          {item.key === 'prediction' && item.status === 'attention' && (
                            <Badge
                              variant="outline"
                              className="mt-2 border-primary/30 bg-primary/10 px-1.5 py-0 text-2xs text-primary"
                            >
                              <Sparkles className="h-3 w-3" />
                              {t('runNow')}
                            </Badge>
                          )}
                          {/* Profile row: surface the Profile Grade letter
                              (independent signal from the contribution score). */}
                          {item.key === 'profile' && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'mt-2 px-1.5 py-0 text-2xs',
                                grade.color,
                                grade.bgColor
                              )}
                            >
                              <TrendingUp className="h-3 w-3" />
                              {tStats('profileScore')}: {grade.grade}
                            </Badge>
                          )}
                          {/* Schools row: surface tier breakdown when at
                              least one school is listed. */}
                          {item.key === 'schools' && schoolCount > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {schoolTiers.reach > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/30 bg-destructive/10 px-1.5 py-0 text-2xs text-destructive"
                                >
                                  {tStats('reach')} {schoolTiers.reach}
                                </Badge>
                              )}
                              {schoolTiers.target > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-primary/30 bg-primary/10 px-1.5 py-0 text-2xs text-primary"
                                >
                                  {tStats('target')} {schoolTiers.target}
                                </Badge>
                              )}
                              {schoolTiers.safety > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-success/30 bg-success/10 px-1.5 py-0 text-2xs text-success"
                                >
                                  {tStats('safety')} {schoolTiers.safety}
                                </Badge>
                              )}
                            </div>
                          )}
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

            {/*
              2026-05: Pipeline strip — closes the lifecycle gap where
              dashboards forgot about a school the moment the user marked
              it SUBMITTED. Renders only when at least one school is past
              IN_PROGRESS, so brand-new users don't see "0 submitted, 0
              accepted, 0 rejected" noise.
            */}
            <DashboardPipelineStrip pipeline={workbench.pipeline} />
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t('priorityQueue')}</h3>
              <Badge variant={workbench.metrics.balancedSchoolList ? 'success' : 'warning'}>
                {workbench.metrics.balancedSchoolList ? t('balanced') : t('needsBalance')}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              {/*
                Skip index 0 — it's already shown as the hero in the left
                column. Showing it twice in one card was one of the explicit
                redundancies users complained about.
              */}
              {/*
                2026-05: Compute "hidden tasks" — pending timeline tasks NOT
                surfaced in the priority queue (the queue caps at 6 server-
                side). Showing this count tells users the queue isn't the
                whole picture and gives them a clear path to the rest.
              */}
              {workbench.priorityQueue.slice(1).map((item) => {
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

              {/* 2026-05: "More pending" footer — when overdue + missing
                  timeline indicators suggest there are more tasks beyond
                  what the queue surfaced, give users a one-click path to
                  the full timeline view. */}
              {(workbench.metrics.overdueTasks > 0 ||
                workbench.metrics.missingTimelineCount > 0) && (
                <Link
                  href="/timeline"
                  className="flex items-center justify-between gap-2 rounded-[var(--theme-radius-card)] border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
                >
                  <span>
                    {workbench.metrics.overdueTasks > 0
                      ? t('viewMoreOverdue', { count: workbench.metrics.overdueTasks })
                      : t('viewMoreMissing', { count: workbench.metrics.missingTimelineCount })}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
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
            {/*
              2026-05: The 4-icon "More tools" strip that lived here was
              promoted into a standalone DashboardWorkspaceHub block (4
              columns × 4 rows = 16 functions + a Stats column). Keeping it
              outside CommandCenter lets the hub render below the workbench
              instead of inside the cramped right column.
            */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// MetricTile removed 2026-05: its content (Score / Due7 / Due30 / TimelineGaps)
// duplicated the readiness progress + contribution items below, contributing to
// the "too many too messy" complaint.
