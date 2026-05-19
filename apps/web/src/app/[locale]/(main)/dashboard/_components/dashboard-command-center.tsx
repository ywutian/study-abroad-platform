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
  User,
} from 'lucide-react';

import { DashboardQuickAddSchool } from './dashboard-quick-add-school';
import {
  toneFromReadinessStatus,
  toneFromSeverity,
  type DashboardDeadlineItem,
  type DashboardPriorityItem,
  type DashboardTone,
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
  /**
   * 2026-05 Phase 1 Bug 6: tighter onboarding gate. Previously triggered
   * only on (completeness === 0 && schoolCount === 0), which falsely
   * matched experienced users who had 105 predictions / cases / etc.
   * Now also require predictionsCount === 0 && casesCount === 0 so the
   * "Welcome to Lumni" hero appears only for truly new accounts.
   */
  predictionsCount?: number;
  casesCount?: number;
  /**
   * 2026-05 Phase 2.7 #28: Self-reported applicant grade. Drives a
   * grade-aware rhythm subtitle next to the workbench label badge
   * (e.g., SENIOR users see "Submission season" instead of the generic
   * rhythm message). Optional + gracefully falls back to the generic
   * rhythm when grade is null/missing/unknown.
   */
  grade?: string | null;
}

// 2026-05 Phase 2.7 #28: well-known Profile.grade values. Anything outside
// this set falls through to the generic rhythm message.
const KNOWN_GRADES = ['FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'GAP_YEAR'] as const;
type KnownGrade = (typeof KNOWN_GRADES)[number];

function isKnownGrade(value: string | null | undefined): value is KnownGrade {
  return typeof value === 'string' && (KNOWN_GRADES as readonly string[]).includes(value);
}

/**
 * 2026-05 Phase 2.5c: Unified tone meta — single source of truth for the
 * 4-color visual vocabulary (critical / warning / neutral / success).
 *
 * Previously this file maintained two parallel maps (`severityMeta` with
 * 4 fields and `statusMeta` with 1) that drifted on every visual tweak:
 * the same `border-destructive/25 bg-destructive/5` string was duplicated
 * in 4 places. Now severity AND readiness status both project through
 * `toneFromSeverity()` / `toneFromReadinessStatus()` to a single
 * `DashboardTone`, and consumers look up exactly one meta entry.
 */
const toneMeta: Record<
  DashboardTone,
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
  neutral: {
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

/**
 * 2026-05 dashboard redesign batch 3: a single deadline row. Extracted
 * so the two-segment deadline strip (urgent ≤7d / upcoming) renders
 * identical rows without duplicating the markup. `deadlineLabel` is
 * passed pre-formatted so this stays a pure presentational component
 * (no `useTranslations` needed).
 */
function DeadlineRow({
  item,
  deadlineLabel,
}: {
  item: DashboardDeadlineItem;
  deadlineLabel: string;
}) {
  const meta = toneMeta[toneFromSeverity(item.severity)];
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-[var(--theme-radius-card)] border border-border px-3 py-2 transition-colors hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]"
    >
      <CircleAlert className={cn('h-4 w-4 shrink-0', meta.text)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {deadlineLabel}
      </span>
    </Link>
  );
}

export function DashboardCommandCenter({
  workbench,
  completingTaskId,
  onCompleteTask,
  completeness,
  schoolTiers,
  schoolCount,
  predictionsCount = 0,
  casesCount = 0,
  grade: applicantGrade,
}: DashboardCommandCenterProps) {
  const t = useTranslations('dashboard.workbench');
  const tCenter = useTranslations('dashboard.commandCenter');
  const tStats = useTranslations('dashboard.stats');
  const topAction = workbench.priorityQueue[0];
  const topSeverity = toneMeta[topAction ? toneFromSeverity(topAction.severity) : 'neutral'];
  // 2026-05 Phase 2.7 #28: grade-aware rhythm message. When the user's
  // Profile.grade is a known value, swap the generic rhythm subtitle for
  // a grade-specific one ("Submission season" for SENIOR vs "Long-term
  // planning" for FRESHMAN). Unknown / null grades fall back to generic.
  const rhythmMessage = isKnownGrade(applicantGrade)
    ? t(`rhythmByGrade.${applicantGrade}`)
    : t('rhythm');
  const gradeLabel = isKnownGrade(applicantGrade) ? t(`gradeLabel.${applicantGrade}`) : null;
  // 2026-05: when a brand-new user has zero profile data AND zero schools,
  // showing "0%" everywhere is demoralizing. Switch the hero region to a
  // welcoming onboarding card instead. The right column (priority queue +
  // deadline stream) keeps rendering normally so the page never feels empty.
  // 2026-05 Phase 1 Bug 6: empty onboarding hero only for truly new
  // accounts. Previously triggered on (completeness===0 && schoolCount===0)
  // alone, which falsely matched experienced users with 105 predictions /
  // cases / etc — causing "Welcome to Lumni" to appear next to "已生成
  // 105 次录取预测". Now also require predictionsCount + casesCount === 0.
  const isEmptyOnboarding =
    completeness === 0 && schoolCount === 0 && predictionsCount === 0 && casesCount === 0;
  const formatDeadline = (daysLeft: number) => {
    if (daysLeft < 0) return t('deadlineOverdue', { count: Math.abs(daysLeft) });
    if (daysLeft === 0) return t('deadlineToday');
    return t('deadlineDays', { count: daysLeft });
  };
  // 2026-05 dashboard redesign batch 3: multi-critical signal. The hero
  // only renders priorityQueue[0]; when several critical items exist the
  // others are visually demoted into the queue body below. Surface the
  // count so a stressed user knows there are N fires, not 1. The queue
  // is sorted critical-first, so any critical means [0] is critical —
  // `criticalCount > 1` ⟺ topAction critical AND there are more.
  const criticalCount = workbench.priorityQueue.filter(
    (item) => item.severity === 'critical'
  ).length;
  // 2026-05 dashboard redesign batch 3: two-segment deadline strip. The
  // old flat `.slice(0, 5)` list let an 8–30-day deadline ("you should
  // START this essay now") fall off the bottom behind nearer items —
  // the "deadline black hole". Partition into an urgent (≤7d, includes
  // overdue) band and an everything-later band so mid-range deadlines
  // always get a labelled home and a visible "act now" cue. Both bands
  // render in full (no client slice): `deadlineStream` is already
  // server-capped at 8 items, so there is nothing to silently truncate;
  // the section-level "view timeline" link is the see-everything path.
  const urgentDeadlines = workbench.deadlineStream.filter((item) => item.daysLeft <= 7);
  const upcomingDeadlines = workbench.deadlineStream.filter((item) => item.daysLeft > 7);

  return (
    <Card className="overflow-hidden rounded-[var(--theme-radius-card)] border-border bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]">
      <CardContent className="p-0">
        {/*
          2026-05 dashboard redesign batch 2: CommandCenter is now a
          single vertical column (hero + readiness on top, priority
          queue + deadline stream below the divider). The previous
          internal xl two-column split (1fr main + 390px fixed) was
          REMOVED because the card now lives inside the page-level
          two-column workbench grid — nesting a 2-col card inside a
          2-col page produced a ~437px left sub-column at xl that
          crushed the 5-up readiness grid to ~87px/cell. One nesting
          level only: the page grid owns the horizontal split, this
          card owns the vertical flow.
        */}
        <div className="min-w-0">
          <div className="min-w-0 border-b border-border p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t('label')}</Badge>
                  {/* 2026-05 Phase 2.7 #28: show grade as a chip when known
                      so the rhythm context is also self-evident to the user
                      ("you're a Senior; submit-season copy is intentional"). */}
                  {gradeLabel && (
                    <Badge variant="outline" className="text-2xs">
                      {gradeLabel}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{rhythmMessage}</span>
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
                      {/* 2026-05 batch 3: multi-critical cue — tell the
                          user the hero is 1 of N fires, not the whole
                          story. The other criticals render in the queue
                          immediately below this card section. */}
                      {criticalCount > 1 && (
                        <Badge variant="destructive" className="mt-2">
                          <CircleAlert className="h-3.5 w-3.5" />
                          {t('moreCritical', { count: criticalCount - 1 })}
                        </Badge>
                      )}
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
              {/*
                2026-05 dashboard redesign batch 2: readiness grid
                breakpoints re-keyed to the page-level two-column
                workbench. CommandCenter now sits in the MAIN column
                (1fr after a ~21rem sidebar), so the old `lg:grid-cols-5`
                crushed the 5 items to ~109px/cell at lg. New ladder:
                1-col phones → 2-col sm (≈285px/cell at lg viewport) →
                3-col xl (≈264px/cell) → 5-col only at 2xl where the
                main column is genuinely wide. Inner card uses truncate
                + shrink-0 + flex-wrap badges so it stays legible.
                The matching skeleton in loading.tsx uses this exact
                breakpoint string — keep them in sync (CLS).
              */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {workbench.readiness.items.map((item) => {
                  const meta = toneMeta[toneFromReadinessStatus(item.status)];
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
                        meta.border
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
                          {/* 2026-05 dashboard redesign batch 3: the
                              profile letter-grade chip (A–D, from
                              getProfileGrade) was REMOVED. It was a third
                              encoding of profile completeness — the same
                              number already shown as `profileContribution/40`
                              on this row and as a % in the onboarding
                              banner. A letter grade on a completeness
                              metric also reads like an academic transcript
                              grade ("the platform gave my kid a C"), an
                              emotional misfire for anxious applicants. One
                              honest signal per number. */}
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
                        <span
                          className="shrink-0 text-sm font-semibold tabular-nums"
                          // 2026-05 Phase 1 design piggyback #12: a11y —
                          // bare "10/10" is hard for screen readers to
                          // interpret without context.
                          aria-label={`${item.label}: ${item.value}`}
                        >
                          {item.value}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5" data-tour="dashboard-priority-queue">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t('priorityQueue')}</h3>
              {/* 2026-05 Phase 1 design piggyback #10: "待均衡" badge in
                  0-school accounts is meaningless ("nothing to balance");
                  hide it until the user has added at least one school. */}
              {schoolCount > 0 && (
                <Badge variant={workbench.metrics.balancedSchoolList ? 'success' : 'warning'}>
                  {workbench.metrics.balancedSchoolList ? t('balanced') : t('needsBalance')}
                </Badge>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {/*
                Skip index 0 — it's already shown as the hero above.
                Showing it twice in one card was one of the explicit
                redundancies users complained about.
              */}
              {/*
                2026-05: Compute "hidden tasks" — pending timeline tasks NOT
                surfaced in the priority queue (the queue caps at 6 server-
                side). Showing this count tells users the queue isn't the
                whole picture and gives them a clear path to the rest.
              */}
              {workbench.priorityQueue.slice(1).map((item) => {
                const meta = toneMeta[toneFromSeverity(item.severity)];
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
              {urgentDeadlines.length > 0 || upcomingDeadlines.length > 0 ? (
                <div className="space-y-4">
                  {urgentDeadlines.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-destructive">
                        {t('deadlineSegmentUrgent')}
                      </p>
                      {urgentDeadlines.map((item) => (
                        <DeadlineRow
                          key={`${item.type}-${item.id}`}
                          item={item}
                          deadlineLabel={formatDeadline(item.daysLeft)}
                        />
                      ))}
                    </div>
                  )}
                  {upcomingDeadlines.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('deadlineSegmentUpcoming')}
                      </p>
                      {upcomingDeadlines.map((item) => (
                        <DeadlineRow
                          key={`${item.type}-${item.id}`}
                          item={item}
                          deadlineLabel={formatDeadline(item.daysLeft)}
                        />
                      ))}
                    </div>
                  )}
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
