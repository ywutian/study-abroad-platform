'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from '@/lib/i18n/navigation';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

import type { DashboardData } from './dashboard-workbench-model';

interface DashboardStatsProps {
  dashboard: DashboardData | undefined;
  /**
   * 2026-05 dashboard redesign batch 2: when DashboardStats lives in the
   * de-ranked right sidebar of the two-column workbench, it renders
   * default-OPEN — a sidebar holding only collapsed bars reads as empty
   * clutter, whereas an open "where am I" snapshot earns the column's
   * footprint. In the legacy single-column stack it stayed collapsed.
   * Defaults to `false` (collapsed) to preserve the old behaviour.
   */
  defaultOpen?: boolean;
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
export function DashboardStats({ dashboard, defaultOpen = false }: DashboardStatsProps) {
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
      // 2026-05 fix: /verification doesn't exist as a user route (only
      // /admin/verifications, which is ADMIN-only). The user-facing
      // verification flow lives via the <VerificationStatusCard /> on
      // the profile page. Linking to /verification produced a 404 (per
      // production console screenshot 2026-05-16).
      href: '/profile',
    },
    { label: t('stats.chatUnread'), value: signals?.chatUnread ?? 0, href: '/chat' },
  ];

  return (
    // 2026-05 dashboard redesign batch 1: snapshot stats are a
    // "where am I" reference surface, not a next action.
    // Batch 2: open state is now caller-controlled — collapsed in the
    // legacy stack, default-open in the two-column workbench sidebar.
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="overflow-hidden rounded-[var(--theme-radius-card)] border-border bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]">
        <CardContent className="p-4 sm:p-5">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-left">
            <span className="block">
              <span className="block text-base font-semibold">{tStats('snapshotTitle')}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {tStats('snapshotSubtitle')}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>

          {/* 2026-05 dashboard redesign batch 2: fixed 2-col grid. This
              card now lives in the ~21rem workbench sidebar, so the old
              viewport-keyed `sm:grid-cols-3 lg:grid-cols-5` ladder would
              crush 9 tiles to ~52px each at lg+. 2-col → 5 rows fits the
              narrow column cleanly. Inner Link uses tabular-nums so
              numbers stay aligned column-down. */}
          <CollapsibleContent>
            <ul role="list" className="mt-3 grid grid-cols-2 gap-2">
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
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
