'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { ChevronRight, Home } from 'lucide-react';

export function AdminBreadcrumb() {
  const t = useTranslations('admin');
  const tAria = useTranslations('common.aria');
  const pathname = usePathname();

  // Only show breadcrumb when deeper than /admin (i.e. has sub-path)
  const segments = pathname
    .replace(/^\/admin\/?/, '')
    .split('/')
    .filter(Boolean);
  if (segments.length === 0) return null;

  const LABEL_MAP: Record<string, string> = {
    users: t('sidebar.users'),
    schools: t('sidebar.schools'),
    calendar: t('sidebar.calendar'),
    calibrations: t('sidebar.calibrations'),
    essays: t('sidebar.essays'),
    points: t('sidebar.points'),
    'points-redemptions': t('sidebar.pointsRedemptions'),
    verifications: t('sidebar.verifications'),
    moderation: t('sidebar.moderation'),
    payments: t('sidebar.payments'),
    'audit-logs': t('sidebar.auditLogs'),
    analytics: t('sidebar.analytics'),
    'activity-templates': t('sidebar.activityTemplates'),
    'ai-agent': t('sidebar.aiAgent'),
    'ai-operations': t('sidebar.aiOps'),
    memory: t('sidebar.memory'),
    health: t('sidebar.health'),
    settings: t('sidebar.settings'),
    'data-review': t('sidebar.dataReview'),
    team: t('sidebar.team'),
    'high-schools': t('sidebar.highSchools'),
  };

  const crumbs: { label: string; href: string }[] = [
    { label: t('sidebar.overview'), href: '/admin' },
  ];

  let currentPath = '/admin';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = LABEL_MAP[segment] || segment;
    crumbs.push({ label, href: currentPath });
  }

  return (
    <nav
      aria-label={tAria('breadcrumb')}
      className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {i === 0 ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Home className="h-3.5 w-3.5" />
              </Link>
            ) : isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
