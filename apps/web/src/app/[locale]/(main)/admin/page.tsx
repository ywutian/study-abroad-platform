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
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

  const { data: health } = useQuery({
    queryKey: ['adminHealth'],
    queryFn: () =>
      apiClient.get<{
        status: string;
        components: Record<string, { status: string; details?: any }>;
      }>('/admin/ai-agent/health'),
    refetchInterval: 30000,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['adminRecentActivity'],
    queryFn: () =>
      apiClient.get<{
        data: Array<{
          id: string;
          action: string;
          resource: string;
          details?: string;
          createdAt: string;
          admin?: { displayName?: string };
        }>;
      }>('/admin/audit-logs', { params: { pageSize: '8' } }),
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
                    <div className="h-[200px] mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trends.slice(-30)}
                          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="fillPosts" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor="hsl(var(--chart-2, 142 71% 45%))"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="hsl(var(--chart-2, 142 71% 45%))"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            tickFormatter={(v) => v.slice(5)}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: 12,
                              color: 'hsl(var(--popover-foreground))',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="newUsers"
                            name={t('dashboard.newUsers')}
                            stroke="hsl(var(--primary))"
                            fill="url(#fillUsers)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="posts"
                            name={t('dashboard.posts')}
                            stroke="hsl(var(--chart-2, 142 71% 45%))"
                            fill="url(#fillPosts)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Health + Recent Activity */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* System Health */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5" />
                    {t('dashboard.systemHealth')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {health ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {health.status === 'healthy' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-amber-500" />
                        )}
                        <span className="font-medium capitalize">{health.status}</span>
                        <Badge variant={health.status === 'healthy' ? 'success' : 'warning'}>
                          {health.status === 'healthy'
                            ? t('dashboard.allOperational')
                            : t('dashboard.degraded')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(health.components).map(([name, component]) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 rounded-md border px-3 py-2"
                          >
                            <div
                              className={cn(
                                'h-2 w-2 rounded-full',
                                component.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                              )}
                            />
                            <span className="text-sm capitalize">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('dashboard.loadingHealth')}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5" />
                    {t('dashboard.recentActivity')}
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin/audit-logs">{t('dashboard.viewAll')}</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {recentActivity?.data && recentActivity.data.length > 0 ? (
                    <div className="space-y-2">
                      {recentActivity.data.slice(0, 6).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 rounded-md border px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              <span className="text-muted-foreground">
                                {log.admin?.displayName || t('dashboard.system')}
                              </span>{' '}
                              <Badge variant="outline" className="text-xs mx-1">
                                {log.action}
                              </Badge>{' '}
                              <span className="text-muted-foreground">{log.resource}</span>
                            </p>
                            {log.details && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {log.details}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('dashboard.noActivity')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      ) : null}
    </>
  );
}
