'use client';

import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

import type { DashboardData } from './dashboard-workbench-model';

interface DashboardStatsProps {
  dashboard: DashboardData | undefined;
}

interface StatTile {
  label: string;
  value: string | number;
  href: string;
}

/**
 * Snapshot of "where am I?" — high-level user-state numbers that don't
 * fit the readiness/priority/decision narrative of the CommandCenter.
 *
 * 2026-05 Phase 2.5b: extracted from `DashboardWorkspaceHub`'s 4th
 * column. The Hub mixes navigation (Research / Social / Tools links —
 * "where can I go?") with stats ("where am I?"). Information-architecture
 * audit flagged this as a category mistake — stats and nav are different
 * mental models. The Hub keeps 3 nav columns; this card is the at-a-glance
 * counter panel.
 *
 * Renders 9 tiles (the same set the Hub showed):
 *   Followers / Following / Cases / Predictions / Points
 *   + Phase 2b: Assessment / Recommendations / Verification / Chat unread
 *
 * Each tile is a Link that fires the existing
 * `DASHBOARD_EVENTS.hubStatClicked` analytics event (href = stable
 * identifier; survives label translation). Preserved verbatim to avoid
 * funnel discontinuity after the move.
 */
export function DashboardStats({ dashboard }: DashboardStatsProps) {
  const t = useTranslations('dashboard.hub');
  const tStats = useTranslations('dashboard.stats');

  const signals = dashboard?.signals;
  const tiles: StatTile[] = [
    { label: t('stats.followers'), value: dashboard?.stats.followers ?? 0, href: '/followers' },
    { label: t('stats.following'), value: dashboard?.stats.following ?? 0, href: '/followers' },
    { label: t('stats.cases'), value: dashboard?.stats.cases ?? 0, href: '/cases' },
    {
      label: t('stats.predictions'),
      value: dashboard?.stats.predictions ?? 0,
      href: '/prediction',
    },
    { label: t('stats.points'), value: dashboard?.user.points ?? 0, href: '/referral' },
    {
      label: t('stats.assessment'),
      value: signals?.assessment?.mbti ?? signals?.assessment?.holland ?? '—',
      href: '/assessment',
    },
    {
      label: t('stats.recommendations'),
      value: signals?.recommendationCount ?? 0,
      href: '/schools',
    },
    {
      label: t('stats.verification'),
      value: t(`stats.verificationStatus.${signals?.verificationStatus ?? 'unverified'}`),
      href: '/verification',
    },
    { label: t('stats.chatUnread'), value: signals?.chatUnread ?? 0, href: '/chat' },
  ];

  return (
    <Card className="overflow-hidden rounded-[var(--theme-radius-card)] border-border bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{tStats('snapshotTitle')}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{tStats('snapshotSubtitle')}</p>
          </div>
        </div>

        {/* 2026-05 Phase 2.5b: Grid scales 2 → 3 → 5 cols with viewport.
            Inner Link uses tabular-nums on the value side so numbers stay
            aligned column-down. */}
        <ul role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => (
            <li key={tile.label}>
              <Link
                href={tile.href}
                aria-label={`${tile.label}: ${tile.value}`}
                onClick={() =>
                  // Preserve the existing hubStatClicked event — funnel
                  // continuity across the 2.5b refactor (href is stable).
                  trackEvent(DASHBOARD_EVENTS.hubStatClicked, { href: tile.href })
                }
                className={cn(
                  'flex h-full flex-col items-start justify-between gap-1 rounded-[var(--theme-radius-control,0.5rem)]',
                  'border border-border bg-[color:var(--theme-control-bg)] px-3 py-2',
                  'transition-colors hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]'
                )}
              >
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                  {tile.label}
                </span>
                <span className="text-lg font-semibold tabular-nums">{tile.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
