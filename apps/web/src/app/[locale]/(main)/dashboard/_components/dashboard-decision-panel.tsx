'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, HelpCircle, Trophy, XCircle, type LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { DashboardPipeline } from '@study-abroad/shared';

/**
 * DashboardDecisionPanel — surfaces Stage G (decision) state more
 * prominently than the compact PipelineStrip does, with per-status
 * groupings, celebratory framing for acceptances, and a CTA to take
 * follow-up action (Waitlist response, decision commitment, etc.).
 *
 * 2026-05 Phase 2a: 22-product competitor research found that **none**
 * of the surveyed platforms handles the decision-phase well. Lumni's
 * differentiation lives here. MVP consumes the existing
 * `pipeline.recentDecisions` data — no new endpoints or schema.
 *
 * Invariant I6 (Phase 3a doc): renders only when at least one school
 * is in ACCEPTED / WAITLISTED / REJECTED / WITHDRAWN status. PipelineStrip
 * already enforces this gate at the `hasMaterial` check; we apply the
 * same logic so the two surfaces stay in lockstep.
 */
export function DashboardDecisionPanel({ pipeline }: { pipeline?: DashboardPipeline | null }) {
  const t = useTranslations('dashboard.decisionPanel');
  const locale = useLocale();
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';

  if (!pipeline) return null;

  // Invariant I6 — same gate as PipelineStrip.hasMaterial. We don't
  // render unless the user has at least one decided school. (Bare
  // SUBMITTED state belongs to PipelineStrip alone.)
  const decisionsTotal =
    pipeline.accepted + pipeline.rejected + pipeline.waitlisted + pipeline.withdrawn;
  if (decisionsTotal === 0) return null;

  // The card layers two views:
  //   1) Top: 3-stat strip (Accepted | Waitlisted | Rejected) with
  //      celebratory color for accepted > 0
  //   2) Below: top-3 decision rows from `recentDecisions` filtered to
  //      decided (non-SUBMITTED) statuses, so users see the schools.
  const decidedRows = pipeline.recentDecisions
    .filter((row) => ['ACCEPTED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'].includes(row.status))
    .slice(0, 3);

  type StatKind = 'accepted' | 'waitlisted' | 'rejected' | 'withdrawn';
  const STAT_META: Record<StatKind, { icon: LucideIcon; className: string; valueColor: string }> = {
    accepted: {
      icon: CheckCircle2,
      className: 'border-success/30 bg-success/10 text-success',
      valueColor: 'text-success',
    },
    waitlisted: {
      icon: HelpCircle,
      className: 'border-warning/30 bg-warning/10 text-warning',
      valueColor: 'text-warning',
    },
    rejected: {
      icon: XCircle,
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
      valueColor: 'text-destructive',
    },
    withdrawn: {
      icon: XCircle,
      className: 'border-border bg-muted text-muted-foreground',
      valueColor: 'text-muted-foreground',
    },
  };

  // Only show stat tiles for non-zero counts — keeps the visual focused
  // on what's actionable, mirroring PipelineStrip's filter pattern.
  const visibleStats: { kind: StatKind; count: number }[] = (
    ['accepted', 'waitlisted', 'rejected', 'withdrawn'] as const
  )
    .map((kind) => ({ kind, count: pipeline[kind] }))
    .filter((stat) => stat.count > 0);

  return (
    <Card
      className={cn(
        'rounded-[var(--theme-radius-card)] border-border',
        'bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]'
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold">{t('title')}</h3>
            {pipeline.accepted > 0 && (
              <span className="text-xs text-success">
                {t('celebrate', { count: pipeline.accepted })}
              </span>
            )}
          </div>
          <Link href="/timeline" className="text-xs font-medium text-primary hover:underline">
            {t('viewAll')}
          </Link>
        </div>

        {/* Stat tiles row */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {visibleStats.map(({ kind, count }) => {
            const meta = STAT_META[kind];
            const Icon = meta.icon;
            return (
              <div
                key={kind}
                className={cn(
                  'flex items-center gap-2 rounded-[var(--theme-radius-control,0.5rem)]',
                  'border bg-opacity-50 px-3 py-2',
                  meta.className
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-2xs uppercase tracking-wide">{t(`status.${kind}`)}</p>
                  <p className={cn('text-lg font-semibold tabular-nums', meta.valueColor)}>
                    {count}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Decision rows — top 3 most recent decided schools */}
        {decidedRows.length > 0 && (
          <ul role="list" className="space-y-1 border-t border-border pt-3">
            {decidedRows.map((row) => {
              const statKind = row.status.toLowerCase() as StatKind;
              const meta = STAT_META[statKind] ?? STAT_META.withdrawn;
              const Icon = meta.icon;
              const dateLabel = new Date(row.decidedAt).toLocaleDateString(dateLocale);
              return (
                <li key={row.id}>
                  <Link
                    href="/timeline"
                    className={cn(
                      'flex items-center gap-2 rounded-[var(--theme-radius-control,0.5rem)]',
                      'px-2 py-1.5 transition-colors',
                      'hover:bg-[color:var(--theme-control-hover-bg)]'
                    )}
                    aria-label={t('rowAriaLabel', {
                      school: row.schoolName,
                      round: row.round,
                      status: t(`status.${statKind}`),
                    })}
                  >
                    <Icon
                      className={cn('h-3.5 w-3.5 shrink-0', meta.valueColor)}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {row.schoolName}
                      <span className="text-muted-foreground"> · {row.round}</span>
                    </span>
                    <span className={cn('shrink-0 text-2xs font-medium', meta.valueColor)}>
                      {t(`status.${statKind}`)}
                    </span>
                    <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                      {dateLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Waitlist coaching prompt — Lumni's competitive differentiator
            (22-product research showed 0/22 platforms handle waitlist
            response well). Keeps copy ambitious without overstating —
            we link to /timeline where users can manage LOCI drafts. */}
        {pipeline.waitlisted > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('waitlistHint', { count: pipeline.waitlisted })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
