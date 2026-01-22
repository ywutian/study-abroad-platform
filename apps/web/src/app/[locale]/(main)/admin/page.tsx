'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/api';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import {
  Users,
  AlertTriangle,
  FileText,
  UserCheck,
  Shield,
  Database,
  PenTool,
  Calendar,
  Globe,
  Bot,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
}

export default function AdminOverviewPage() {
  const t = useTranslations('admin');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
  });

  const statCards = stats
    ? [
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
          href: '/admin/reports',
        },
        {
          title: t('stats.totalReviews'),
          value: stats.totalReviews,
          icon: UserCheck,
          color: 'violet',
          href: null,
        },
      ]
    : [];

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} icon={Shield} color="violet" />

      {/* Stats cards */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : stats ? (
        <div className="space-y-6 mt-6">
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
                    })}
                  />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <div
                      className={cn('flex h-8 w-8 items-center justify-center rounded-lg', {
                        'bg-blue-500/10 text-blue-500': stat.color === 'blue',
                        'bg-emerald-500/10 text-emerald-500': stat.color === 'emerald',
                        'bg-amber-500/10 text-amber-500': stat.color === 'amber',
                        'bg-primary/10 text-primary': stat.color === 'violet',
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

          {/* Quick actions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.pendingReports > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        {stats.pendingReports} {t('overview.pendingReports')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('overview.needsAttention')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/admin/reports">{t('overview.handle')}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Database className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('overview.dataManagement')}</p>
                    <p className="text-xs text-muted-foreground">{t('overview.schoolsDataDesc')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/schools">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                    <Calendar className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.deadlines')}</p>
                    <p className="text-xs text-muted-foreground">{t('overview.deadlinesDesc')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/deadlines">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10">
                    <PenTool className="h-6 w-6 text-pink-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.essays')}</p>
                    <p className="text-xs text-muted-foreground">{t('overview.essayDesc')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/essays">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
                    <Globe className="h-6 w-6 text-violet-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.events')}</p>
                    <p className="text-xs text-muted-foreground">{t('overview.eventsDesc')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/events">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
                    <Bot className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.aiAgent')}</p>
                    <p className="text-xs text-muted-foreground">{t('overview.aiAgentDesc')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/ai-agent">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      ) : null}
    </>
  );
}
