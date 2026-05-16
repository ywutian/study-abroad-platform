'use client';

import { useTranslations } from 'next-intl';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  Compass,
  FileText,
  Lightbulb,
  type LucideIcon,
  MessageCircle,
  MessageSquare,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import type { DashboardData } from './dashboard-workbench-model';

interface DashboardWorkspaceHubProps {
  /**
   * Dashboard payload — used to surface "at a glance" stats (followers,
   * following, points, predictions count) so the hub doubles as a quick
   * stats panel and saves the user from jumping to /profile or /followers
   * just to see counts.
   */
  dashboard: DashboardData | undefined;
}

interface HubLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Optional badge text shown on the right. Use for unread counts etc. */
  badge?: string;
}

/**
 * Workspace Hub — a categorized panel that surfaces every user-facing
 * function the platform offers, mirroring the global Header navigation
 * groups (Research / Social / Tools) so users can find Forum / Hall /
 * Ranking / Teams / Followers / Vault / Referral / Resume / etc. without
 * leaving the dashboard.
 *
 * 2026-05: Added in response to "功能太少了" + "比如论坛这些找不到".
 * Replaces the previous 4-icon "Tools strip" inside CommandCenter, which
 * only exposed Assessment / AI Coach / Cases / Resume.
 *
 * Design intent:
 * - 4 columns × 4 rows = 16 functions (vs old strip's 4)
 * - Stats column doubles as quick info (no need to jump to /profile or
 *   /followers just to see counts)
 * - Compact icon + label + description rows (NOT the deleted 9-card grid)
 * - Mirrors Header nav groupings so users learn one taxonomy
 */
export function DashboardWorkspaceHub({ dashboard }: DashboardWorkspaceHubProps) {
  const t = useTranslations('dashboard.hub');

  const research: HubLink[] = [
    {
      href: '/cases',
      label: t('links.cases'),
      description: t('links.casesDesc'),
      icon: BookOpen,
    },
    {
      href: '/ranking',
      label: t('links.ranking'),
      description: t('links.rankingDesc'),
      icon: BarChart3,
    },
    {
      href: '/hall',
      label: t('links.hall'),
      description: t('links.hallDesc'),
      icon: Trophy,
    },
    {
      href: '/uncommon-app',
      label: t('links.uncommonApp'),
      description: t('links.uncommonAppDesc'),
      icon: Compass,
    },
  ];

  const social: HubLink[] = [
    {
      href: '/forum',
      label: t('links.forum'),
      description: t('links.forumDesc'),
      icon: MessageSquare,
    },
    {
      href: '/teams',
      label: t('links.teams'),
      description: t('links.teamsDesc'),
      icon: Users,
    },
    {
      href: '/chat',
      label: t('links.chat'),
      description: t('links.chatDesc'),
      icon: MessageCircle,
    },
    {
      href: '/followers',
      label: t('links.followers'),
      description: t('links.followersDesc'),
      icon: UserPlus,
    },
  ];

  const tools: HubLink[] = [
    {
      href: '/timeline',
      label: t('links.timeline'),
      description: t('links.timelineDesc'),
      icon: Calendar,
    },
    {
      href: '/resume',
      label: t('links.resume'),
      description: t('links.resumeDesc'),
      icon: FileText,
    },
    {
      href: '/assessment',
      label: t('links.assessment'),
      description: t('links.assessmentDesc'),
      icon: ClipboardList,
    },
    {
      href: '/ai',
      label: t('links.aiLab'),
      description: t('links.aiLabDesc'),
      icon: Lightbulb,
    },
  ];

  // Stats column — surfaces high-level counts so the user can read
  // them without jumping to /profile or /followers.
  const stats = [
    { label: t('stats.followers'), value: dashboard?.stats.followers ?? 0, href: '/followers' },
    { label: t('stats.following'), value: dashboard?.stats.following ?? 0, href: '/followers' },
    { label: t('stats.cases'), value: dashboard?.stats.cases ?? 0, href: '/cases' },
    {
      label: t('stats.predictions'),
      value: dashboard?.stats.predictions ?? 0,
      href: '/prediction',
    },
    { label: t('stats.points'), value: dashboard?.user.points ?? 0, href: '/referral' },
  ];

  return (
    <Card className="overflow-hidden rounded-[var(--theme-radius-card)] border-border bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{t('title')}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <HubColumn title={t('sections.research')} links={research} />
          <HubColumn title={t('sections.social')} links={social} />
          <HubColumn title={t('sections.tools')} links={tools} />

          {/* Stats column — distinct visual treatment (compact rows, no
              icon, just label + number) so it reads as data, not nav. */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('sections.stats')}
            </h4>
            {/* 2026-05 Phase 1 design piggyback #12: a11y — wrap stats
                as a semantic list so screen readers announce "list of 5
                items" instead of a wall of links. */}
            <ul role="list" className="space-y-1.5">
              {stats.map((stat) => (
                <li key={stat.label}>
                  <Link
                    href={stat.href}
                    aria-label={`${stat.label}: ${stat.value}`}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-[var(--theme-radius-control,0.5rem)]',
                      'border border-border bg-[color:var(--theme-control-bg)] px-2.5 py-1.5',
                      'transition-colors hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]'
                    )}
                  >
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HubColumn({ title, links }: { title: string; links: HubLink[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-1.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'group flex items-start gap-2 rounded-[var(--theme-radius-control,0.5rem)]',
              'border border-border bg-[color:var(--theme-control-bg)] p-2',
              'transition-colors hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center',
                'rounded-[var(--theme-radius-control,0.5rem)] border border-border',
                'bg-[color:var(--theme-card-bg)] text-muted-foreground',
                'transition-colors group-hover:border-primary/30 group-hover:text-primary'
              )}
            >
              <link.icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium">{link.label}</p>
                {link.badge ? (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0 text-2xs font-semibold text-primary">
                    {link.badge}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-2xs text-muted-foreground">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
