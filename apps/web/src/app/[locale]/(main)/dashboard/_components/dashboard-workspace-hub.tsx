'use client';

import { useTranslations } from 'next-intl';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  Compass,
  FileText,
  Gift,
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
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

// 2026-05 Phase 2.5b: DashboardWorkspaceHub no longer needs the
// dashboard payload — the Stats column was extracted to a separate
// `<DashboardStats />` card. Hub is purely navigation now (3 nav
// columns: Research / Social / Tools).

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
 * 2026-05 Phase 2.5b: Stats column extracted to `<DashboardStats />`
 * — Hub is now 3-col navigation only. Information-architecture audit
 * flagged the mixed nav-stats card as a category mistake (nav = "where
 * can I go", stats = "where am I" — different mental models).
 *
 * Design intent:
 * - 3 columns × 4 rows = 12 navigation destinations
 * - Compact icon + label + description rows
 * - Mirrors Header nav groupings so users learn one taxonomy
 */
export function DashboardWorkspaceHub() {
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
    // 2026-05 Phase 2.6 #25: surface the Referral entry on the dashboard
    // — previously buried under a global Header link nobody clicked.
    // Referrals are a key data-flywheel mechanic: each invite drives
    // platform growth AND rewards the inviter (points). Putting it in
    // Tools where users browse means more invite attempts.
    {
      href: '/referral',
      label: t('links.referral'),
      description: t('links.referralDesc'),
      icon: Gift,
    },
  ];

  // 2026-05 Phase 2.5b: Stats column extracted to `<DashboardStats />`
  // (rendered separately on the dashboard). Hub now focuses on
  // navigation only: Research / Social / Tools — 3 cols instead of 4.

  return (
    <Card className="overflow-hidden rounded-[var(--theme-radius-card)] border-border bg-[color:var(--theme-card-bg)] shadow-[var(--theme-card-shadow)]">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{t('title')}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <HubColumn title={t('sections.research')} links={research} />
          <HubColumn title={t('sections.social')} links={social} />
          <HubColumn title={t('sections.tools')} links={tools} />
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
            onClick={() =>
              // 2026-05 Phase 4: track Hub navigation. href is the
              // stable identifier — survives label translation/changes.
              trackEvent(DASHBOARD_EVENTS.hubLinkClicked, { href: link.href })
            }
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
