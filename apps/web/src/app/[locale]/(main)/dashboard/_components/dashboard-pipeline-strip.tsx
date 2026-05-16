'use client';

import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  ClipboardEdit,
  Clock,
  HelpCircle,
  Trophy,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { DashboardWorkbench } from './dashboard-workbench-model';

type PillKind = 'submitted' | 'accepted' | 'rejected' | 'waitlisted' | 'withdrawn';

const PILL_META: Record<PillKind, { icon: LucideIcon; className: string }> = {
  submitted: {
    icon: Clock,
    className: 'border-primary/30 bg-primary/10 text-primary',
  },
  accepted: {
    icon: CheckCircle2,
    className: 'border-success/30 bg-success/10 text-success',
  },
  waitlisted: {
    icon: HelpCircle,
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  rejected: {
    icon: XCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  withdrawn: {
    icon: XCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

const PILL_ORDER: PillKind[] = ['submitted', 'accepted', 'waitlisted', 'rejected', 'withdrawn'];

/**
 * PipelineStrip — visualizes ApplicationTimeline status counts so users
 * can see "where are my applications right now" at a glance, and so the
 * dashboard stops pretending submitted/decided schools don't exist.
 *
 * 2026-05: Closes lifecycle stages F (submitted) and G (decision) which
 * Agent 3 flagged as the most critical gap — previously a school just
 * "disappeared" from the dashboard the moment the user marked it
 * SUBMITTED, with no surface for accepted/waitlisted/rejected counts.
 *
 * Renders nothing when the user has no schools past IN_PROGRESS, so
 * brand-new accounts don't see "0 submitted, 0 accepted" noise.
 */
export function DashboardPipelineStrip({
  pipeline,
}: {
  pipeline?: NonNullable<DashboardWorkbench['pipeline']>;
}) {
  const t = useTranslations('dashboard.pipelineStrip');

  if (!pipeline) return null;

  const decisionsTotal =
    pipeline.accepted + pipeline.rejected + pipeline.waitlisted + pipeline.withdrawn;
  // Only show the strip when at least one school is past IN_PROGRESS,
  // otherwise this duplicates the schools readiness item.
  const hasMaterial = pipeline.submitted + decisionsTotal > 0;
  if (!hasMaterial) return null;

  const counts: Record<PillKind, number> = {
    submitted: pipeline.submitted,
    accepted: pipeline.accepted,
    waitlisted: pipeline.waitlisted,
    rejected: pipeline.rejected,
    withdrawn: pipeline.withdrawn,
  };
  const visiblePills = PILL_ORDER.filter((kind) => counts[kind] > 0);

  return (
    <div className="mt-4 rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-control-bg)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t('title')}</h3>
        </div>
        <Link href="/timeline" className="text-xs font-medium text-primary hover:underline">
          {t('viewAll')}
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visiblePills.map((kind) => {
          const meta = PILL_META[kind];
          const count = counts[kind];
          const Icon = meta.icon;
          return (
            <Link
              key={kind}
              href="/timeline"
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
                'text-xs font-medium transition-colors hover:opacity-90',
                meta.className
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{t(`status.${kind}`)}</span>
              <span className="tabular-nums">{count}</span>
            </Link>
          );
        })}
      </div>

      {/* 2026-05: Per-school decision rows. Replaces the previous "opaque
          counts only" experience with concrete school + round + decision
          age, so users immediately see WHICH schools they've heard back
          from without leaving the dashboard. */}
      {pipeline.recentDecisions.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2">
          {pipeline.recentDecisions.map((decision) => {
            const meta =
              decision.status === 'SUBMITTED'
                ? PILL_META.submitted
                : PILL_META[decision.status.toLowerCase() as Exclude<PillKind, 'submitted'>];
            const Icon = meta.icon;
            // 2026-05 Phase 2.6 #26: decided rows get a "Label result"
            // CTA so users can feed the real admission outcome back into
            // Lumni's prediction calibration loop (PredictionResult.
            // outcomeLabel is schema-ready). This is the data-flywheel
            // moat — competitors don't ask users to log outcomes, so
            // every accepted/rejected label we capture compounds.
            const canLabelOutcome =
              decision.status === 'ACCEPTED' ||
              decision.status === 'REJECTED' ||
              decision.status === 'WAITLISTED';
            return (
              <li key={decision.id}>
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-[var(--theme-radius-control,0.5rem)]',
                    'px-2 py-1 transition-colors hover:bg-[color:var(--theme-control-hover-bg)]'
                  )}
                >
                  <Link href="/timeline" className="flex min-w-0 flex-1 items-center gap-2">
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        meta.className.split(' ').find((c) => c.startsWith('text-'))
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {decision.schoolName}
                      <span className="text-muted-foreground"> · {decision.round}</span>
                    </span>
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 text-2xs font-medium',
                      meta.className.split(' ').find((c) => c.startsWith('text-'))
                    )}
                  >
                    {t(`status.${decision.status.toLowerCase() as PillKind}`)}
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                    {formatRelativeTime(decision.decidedAt, t)}
                  </span>
                  {canLabelOutcome && (
                    <Link
                      href={{
                        pathname: '/prediction',
                        query: { schoolId: decision.schoolId, label: 'outcome' },
                      }}
                      title={t('labelOutcomeHint')}
                      onClick={() =>
                        // 2026-05 Gap A closure: emit the outcome-label
                        // click so funnel F6 (data-flywheel adoption) can
                        // measure what fraction of decided rows feed the
                        // calibration loop. schoolId is already user-owned
                        // (this is the user's own SchoolListItem) — PII-safe.
                        trackEvent(DASHBOARD_EVENTS.outcomeLabelCtaClicked, {
                          schoolId: decision.schoolId,
                          decisionStatus: decision.status,
                        })
                      }
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1 rounded-full border',
                        'border-primary/30 bg-primary/5 px-2 py-0.5 text-2xs font-medium text-primary',
                        'transition-colors hover:bg-primary/10'
                      )}
                    >
                      <ClipboardEdit className="h-3 w-3" aria-hidden="true" />
                      {t('labelOutcomeCta')}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Highlight when the user has any acceptance — celebratory copy
          replaces the bland "you have 1 submitted application" tone. */}
      {pipeline.accepted > 0 && (
        <p className="mt-2 text-xs text-success">{t('celebrate', { count: pipeline.accepted })}</p>
      )}
    </div>
  );
}

/**
 * Renders "3d ago", "yesterday", "today" etc. Locale-agnostic via
 * the shared dashboard.pipelineStrip i18n keys. Uses simple thresholds
 * — no date-fns dependency added for one usage.
 */
function formatRelativeTime(
  iso: string,
  t: (key: string, values?: Record<string, number>) => string
): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - target;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return t('relativeJustNow');
  if (diffMin < 60) return t('relativeMin', { count: diffMin });
  if (diffHr < 24) return t('relativeHour', { count: diffHr });
  if (diffDay < 7) return t('relativeDay', { count: diffDay });
  if (diffDay < 30) return t('relativeWeek', { count: Math.floor(diffDay / 7) });
  return t('relativeMonth', { count: Math.floor(diffDay / 30) });
}
