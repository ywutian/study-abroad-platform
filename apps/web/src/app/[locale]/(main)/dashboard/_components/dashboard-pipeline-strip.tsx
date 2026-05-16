'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, Clock, HelpCircle, Trophy, XCircle, type LucideIcon } from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
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
      {/* Highlight when the user has any acceptance — celebratory copy
          replaces the bland "you have 1 submitted application" tone. */}
      {pipeline.accepted > 0 && (
        <p className="mt-2 text-xs text-success">{t('celebrate', { count: pipeline.accepted })}</p>
      )}
    </div>
  );
}
