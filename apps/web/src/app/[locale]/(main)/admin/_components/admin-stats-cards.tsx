'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import {
  Users,
  AlertTriangle,
  FileText,
  UserCheck,
  Ban,
  DollarSign,
  Database,
  Calendar,
  PenTool,
  Globe,
  MessageCircle,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
  bannedUsers?: number;
  totalRevenue?: number;
}

interface AdminStatsCardsProps {
  stats: AdminStats;
  /** @deprecated Use permissions instead */
  isAdmin?: boolean;
  permissions?: string[];
}

export function AdminStatsCards({ stats, permissions = [] }: AdminStatsCardsProps) {
  const t = useTranslations('admin');

  const statCards = [
    {
      title: t('stats.totalUsers'),
      value: stats.totalUsers,
      sub: `${stats.verifiedUsers} ${t('roles.verified')}`,
      icon: Users,
      color: 'blue',
      href: '/admin/users',
    },
    {
      title: t('stats.totalCases'),
      value: stats.totalCases,
      icon: FileText,
      color: 'emerald',
      href: null,
    },
    {
      title: t('stats.pendingReports'),
      value: stats.pendingReports,
      icon: AlertTriangle,
      color: 'amber',
      href: '/admin/moderation?tab=reports',
    },
    {
      title: t('stats.totalReviews'),
      value: stats.totalReviews,
      icon: UserCheck,
      color: 'violet',
      href: null,
    },
    ...(stats.bannedUsers !== undefined
      ? [
          {
            title: t('dashboard.bannedUsers'),
            value: stats.bannedUsers,
            icon: Ban,
            color: 'red' as const,
            href: '/admin/users' as const,
          },
        ]
      : []),
    ...(stats.totalRevenue !== undefined
      ? [
          {
            title: t('dashboard.revenue'),
            value: `$${((stats.totalRevenue ?? 0) / 100).toFixed(0)}`,
            icon: DollarSign,
            color: 'emerald' as const,
            href: '/admin/payments' as const,
          },
        ]
      : []),
  ];

  const has = (perm: string) => permissions.includes(perm);

  const allQuickActions = [
    // Urgent: pending reports
    stats.pendingReports > 0 &&
      has('content:moderate') && {
        href: '/admin/moderation?tab=reports',
        icon: AlertTriangle,
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        title: `${stats.pendingReports} ${t('overview.pendingReports')}`,
        desc: t('overview.needsAttention'),
        urgent: true,
      },
    has('school:edit') && {
      href: '/admin/schools',
      icon: Database,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
      title: t('overview.dataManagement'),
      desc: t('overview.schoolsDataDesc'),
    },
    has('calendar:manage') && {
      href: '/admin/calendar',
      icon: Calendar,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      title: t('sidebar.deadlines'),
      desc: t('overview.deadlinesDesc'),
    },
    has('essay:manage') && {
      href: '/admin/essays',
      icon: PenTool,
      iconBg: 'bg-pink-500/10',
      iconColor: 'text-pink-500',
      title: t('sidebar.essays'),
      desc: t('overview.essayDesc'),
    },
    has('calendar:manage') && {
      href: '/admin/calendar?tab=events',
      icon: Globe,
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
      title: t('sidebar.events'),
      desc: t('overview.eventsDesc'),
    },
    has('ai:config') && {
      href: '/admin/ai-operations',
      icon: MessageCircle,
      iconBg: 'bg-cyan-500/10',
      iconColor: 'text-cyan-500',
      title: t('sidebar.aiAgent'),
      desc: t('overview.aiAgentDesc'),
    },
    has('content:moderate') && {
      href: '/admin/moderation',
      icon: ShieldCheck,
      iconBg: 'bg-teal-500/10',
      iconColor: 'text-teal-500',
      title: t('sidebar.content'),
      desc: t('contentMod.description'),
    },
    has('payment:view') && {
      href: '/admin/payments',
      icon: CreditCard,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
      title: t('sidebar.payments'),
      desc: t('payments.description'),
    },
  ];

  const quickActions = allQuickActions.filter(Boolean) as Array<{
    href: string;
    icon: typeof AlertTriangle;
    iconBg: string;
    iconColor: string;
    title: string;
    desc: string;
    urgent?: boolean;
  }>;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const StatIcon = stat.icon;
          const content = (
            <Card
              className={cn(
                'overflow-hidden transition-shadow',
                stat.href && 'cursor-pointer hover:shadow-md'
              )}
            >
              <div
                className={cn('h-1 bg-gradient-to-r', {
                  'bg-primary': stat.color === 'blue' || stat.color === 'violet',
                  'bg-success': stat.color === 'emerald',
                  'bg-warning': stat.color === 'amber',
                  'bg-destructive': stat.color === 'red',
                })}
              />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-body-sm font-medium">{stat.title}</CardTitle>
                <div
                  className={cn('flex h-8 w-8 items-center justify-center rounded-lg', {
                    'bg-blue-500/10 text-blue-500': stat.color === 'blue',
                    'bg-emerald-500/10 text-emerald-500': stat.color === 'emerald',
                    'bg-amber-500/10 text-amber-500': stat.color === 'amber',
                    'bg-primary/10 text-primary': stat.color === 'violet',
                    'bg-red-500/10 text-red-500': stat.color === 'red',
                  })}
                >
                  <StatIcon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={cn('text-3xl font-bold', {
                    'text-blue-600': stat.color === 'blue',
                    'text-emerald-600': stat.color === 'emerald',
                    'text-amber-600': stat.color === 'amber',
                    'text-primary': stat.color === 'violet',
                    'text-red-600': stat.color === 'red',
                  })}
                >
                  {stat.value}
                </div>
                {stat.sub && <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>}
              </CardContent>
            </Card>
          );

          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {stat.href ? <Link href={stat.href}>{content}</Link> : content}
            </motion.div>
          );
        })}
      </div>

      {/* Quick actions — shown based on effective permissions */}
      {quickActions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Card className={action.urgent ? 'border-amber-500/30 bg-amber-500/5' : undefined}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl',
                        action.iconBg
                      )}
                    >
                      <ActionIcon className={cn('h-6 w-6', action.iconColor)} />
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          'font-semibold',
                          action.urgent && 'text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={action.href}>
                        {action.urgent ? t('overview.handle') : t('overview.manage')}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}
