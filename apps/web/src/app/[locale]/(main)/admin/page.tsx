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
  Ban,
  DollarSign,
  TrendingUp,
  MessageSquare,
  CreditCard,
  ShieldCheck,
  Coins,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalCases: number;
  pendingReports: number;
  totalReviews: number;
  newUsersToday?: number;
  activeUsersToday?: number;
  bannedUsers?: number;
  totalRevenue?: number;
  monthlyRevenue?: number;
  totalPosts?: number;
  pendingVerifications?: number;
  subscriptionDistribution?: Record<string, number>;
}

interface TrendData {
  date: string;
  newUsers: number;
  payments: number;
  revenue: number;
  posts: number;
}

export default function AdminOverviewPage() {
  const t = useTranslations('admin');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => apiClient.get<AdminStats>('/admin/stats'),
  });

  const { data: trends } = useQuery({
    queryKey: ['adminTrends'],
    queryFn: () => apiClient.get<TrendData[]>('/admin/stats/trends'),
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
                      'bg-destructive': stat.color === 'red',
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                    <Coins className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.points')}</p>
                    <p className="text-xs text-muted-foreground">{t('points.description')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/points">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10">
                    <ShieldCheck className="h-6 w-6 text-teal-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.content')}</p>
                    <p className="text-xs text-muted-foreground">{t('contentMod.description')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/content">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10">
                    <CreditCard className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{t('sidebar.payments')}</p>
                    <p className="text-xs text-muted-foreground">{t('payments.description')}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/admin/payments">{t('overview.manage')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Trends */}
          {trends && trends.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {t('dashboard.trends')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t('dashboard.newUsers')}</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {trends.reduce((sum, d) => sum + d.newUsers, 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t('dashboard.revenue')}</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          ${trends.reduce((sum, d) => sum + (Number(d.revenue) || 0), 0).toFixed(0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t('dashboard.posts')}</p>
                        <p className="text-2xl font-bold text-violet-600">
                          {trends.reduce((sum, d) => sum + d.posts, 0)}
                        </p>
                      </div>
                    </div>
                    {/* Simple bar chart visualization */}
                    <div className="flex items-end gap-[2px] h-24 mt-4">
                      {trends.slice(-30).map((d, i) => {
                        const max = Math.max(...trends.map((t) => t.newUsers), 1);
                        const height = (d.newUsers / max) * 100;
                        return (
                          <div
                            key={i}
                            className="flex-1 bg-blue-500/60 rounded-t-sm hover:bg-blue-500 transition-colors"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${d.date}: ${d.newUsers} ${t('dashboard.newUsers')}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">{trends[0]?.date}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {trends[trends.length - 1]?.date}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      ) : null}
    </>
  );
}
