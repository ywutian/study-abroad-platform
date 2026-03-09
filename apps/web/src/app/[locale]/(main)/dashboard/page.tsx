'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Search,
  FileCheck,
  Star,
  MessageCircle,
  ArrowRight,
  User,
  GraduationCap,
  ListChecks,
  TrendingUp,
  Clock,
  Zap,
  AlertCircle,
  Trophy,
  CalendarDays,
} from 'lucide-react';
import { QuickExperience } from '@/components/features/onboarding/quick-experience';

interface DashboardData {
  user: {
    email: string;
    role: string;
    points: number;
    createdAt: string;
  };
  profile: {
    completeness: number;
    hasTestScores: boolean;
    hasActivities: boolean;
    hasAwards: boolean;
    targetSchoolCount: number;
    essayCount: number;
    schoolTiers: {
      reach: number;
      target: number;
      safety: number;
    };
  };
  stats: {
    followers: number;
    following: number;
    cases: number;
    predictions: number;
  };
  pendingTasks: {
    total: number;
    byType: { type: string; count: number }[];
    profileGaps: string[];
  };
  upcomingDeadlines: {
    id: string;
    schoolName: string;
    round: string;
    deadline: string;
    daysLeft: number;
  }[];
  upcomingPersonalEvents?: {
    id: string;
    title: string;
    category: string;
    deadline: string | null;
    eventDate: string | null;
    daysLeft: number;
  }[];
  recentActivity: {
    type: string;
    title: string;
    description: string;
    createdAt: string;
  }[];
}

// Profile grade mapping
function getProfileGrade(completeness: number): {
  grade: string;
  color: string;
  bgColor: string;
} {
  if (completeness >= 90)
    return { grade: 'A', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' };
  if (completeness >= 75) return { grade: 'B+', color: 'text-blue-600', bgColor: 'bg-blue-500/10' };
  if (completeness >= 60) return { grade: 'B', color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
  if (completeness >= 40)
    return { grade: 'C', color: 'text-amber-600', bgColor: 'bg-amber-500/10' };
  return { grade: 'D', color: 'text-red-600', bgColor: 'bg-red-500/10' };
}

// 4 Main modules configuration
const mainModules = [
  {
    id: 'schools',
    href: '/schools',
    icon: Search,
    titleKey: 'dashboard.modules.schools',
    descKey: 'dashboard.modules.schoolsDesc',
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
  },
  {
    id: 'uncommon-app',
    href: '/uncommon-app',
    icon: FileCheck,
    titleKey: 'dashboard.modules.uncommonApp',
    descKey: 'dashboard.modules.uncommonAppDesc',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    id: 'feature-hall',
    href: '/hall',
    icon: Star,
    titleKey: 'dashboard.modules.featureHall',
    descKey: 'dashboard.modules.featureHallDesc',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
  {
    id: 'forum',
    href: '/forum',
    icon: MessageCircle,
    titleKey: 'dashboard.modules.forum',
    descKey: 'dashboard.modules.forumDesc',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
];

interface TodoItem {
  id: string;
  type: 'school' | 'event';
  title: string;
  subtitle: string;
  date: Date;
  dateStr: string;
  daysLeft: number;
}

export default function DashboardPage() {
  const t = useTranslations();
  const locale = useLocale();

  // Fetch aggregated dashboard data from backend
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>('/users/me/dashboard'),
  });

  const completeness = dashboard?.profile.completeness ?? 0;
  const schoolCount = dashboard?.profile.targetSchoolCount ?? 0;
  const schoolTiers = dashboard?.profile.schoolTiers ?? { reach: 0, target: 0, safety: 0 };
  const pendingTotal = dashboard?.pendingTasks.total ?? 0;
  const profileGaps = dashboard?.pendingTasks.profileGaps ?? [];
  const grade = getProfileGrade(completeness);

  // Effective pending count: use profileGaps if no ApplicationTask data
  const effectivePending = pendingTotal > 0 ? pendingTotal : profileGaps.length;

  const todoList = useMemo<TodoItem[]>(() => {
    const items: TodoItem[] = [];
    const dateFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });

    for (const d of dashboard?.upcomingDeadlines ?? []) {
      const date = new Date(d.deadline);
      items.push({
        id: d.id,
        type: 'school',
        title: d.schoolName,
        subtitle: d.round,
        date,
        dateStr: dateFmt.format(date),
        daysLeft: d.daysLeft,
      });
    }

    for (const ev of dashboard?.upcomingPersonalEvents ?? []) {
      const raw = ev.deadline ?? ev.eventDate;
      if (!raw) continue;
      const date = new Date(raw);
      items.push({
        id: ev.id,
        type: 'event',
        title: ev.title,
        subtitle: ev.category,
        date,
        dateStr: dateFmt.format(date),
        daysLeft: ev.daysLeft,
      });
    }

    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return items.slice(0, 10);
  }, [dashboard?.upcomingDeadlines, dashboard?.upcomingPersonalEvents, locale]);

  return (
    <PageContainer>
      {/* Onboarding Quick Experience — auto-shows on first login */}
      <QuickExperience />
      <div className="space-y-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-title">
              {t('dashboard.welcome', {
                name: dashboard?.user.email?.split('@')[0] || t('dashboard.user'),
              })}
            </h1>
            <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
          </div>
          <Link href="/profile">
            <Button variant="outline" size="sm">
              <User className="w-4 h-4 mr-2" />
              {t('dashboard.editProfile')}
            </Button>
          </Link>
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Profile Completion */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.stats.profileCompletion')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={completeness} className="flex-1 h-2" />
                    <span className="text-sm font-medium">{completeness}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* School List Count with Tier Breakdown */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-violet-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{t('dashboard.stats.schoolList')}</p>
                  <p className="text-2xl font-bold">{schoolCount}</p>
                  {schoolCount > 0 && (
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {schoolTiers.reach > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-rose-300 text-rose-600 bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:bg-rose-950/30"
                        >
                          {t('dashboard.stats.reach')} {schoolTiers.reach}
                        </Badge>
                      )}
                      {schoolTiers.target > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-950/30"
                        >
                          {t('dashboard.stats.target')} {schoolTiers.target}
                        </Badge>
                      )}
                      {schoolTiers.safety > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/30"
                        >
                          {t('dashboard.stats.safety')} {schoolTiers.safety}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Tasks (real data) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <ListChecks className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.stats.pendingTasks')}
                  </p>
                  <p className="text-2xl font-bold">{effectivePending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Grade */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    grade.bgColor
                  )}
                >
                  <TrendingUp className={cn('w-6 h-6', grade.color)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.stats.profileScore')}
                  </p>
                  <p className={cn('text-2xl font-bold', grade.color)}>{grade.grade}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 4 Main Module Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-body-lg font-semibold mb-4">{t('dashboard.quickAccess')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mainModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <Link href={module.href}>
                    <Card className="group h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
                      {/* Gradient top border on hover */}
                      <div
                        className={cn(
                          'absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity',
                          module.color
                        )}
                      />

                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
                              module.bgColor
                            )}
                          >
                            <Icon className={cn('w-6 h-6', module.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold group-hover:text-primary transition-colors">
                              {t(module.titleKey)}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {t(module.descKey)}
                            </p>
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <div className="mt-4 flex items-center justify-end text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>{t('common.enter')}</span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Upcoming Deadlines + Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          {/* Upcoming Deadlines — unified todo list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t('dashboard.upcomingDeadlines')}
              </CardTitle>
              <Link href="/timeline">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  {t('dashboard.viewAll')}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {todoList.length > 0 ? (
                <div className="space-y-3">
                  {todoList.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-3 py-2 border-b last:border-0"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          item.type === 'school' ? 'bg-violet-500/10' : 'bg-amber-500/10'
                        )}
                      >
                        {item.type === 'school' ? (
                          <GraduationCap className="w-4 h-4 text-violet-500" />
                        ) : (
                          <Trophy className="w-4 h-4 text-amber-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 shrink-0',
                              item.type === 'school'
                                ? 'border-violet-300 text-violet-600 bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:bg-violet-950/30'
                                : 'border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30'
                            )}
                          >
                            {t(`dashboard.todoType.${item.type}`)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <CalendarDays className="w-3 h-3" />
                            {item.dateStr}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-2 shrink-0',
                          item.daysLeft <= 3
                            ? 'border-red-300 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30'
                            : item.daysLeft <= 7
                              ? 'border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30'
                              : 'border-gray-300 text-gray-600 bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:bg-gray-900/30'
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            'w-3 h-3 mr-1',
                            item.daysLeft <= 3
                              ? 'text-red-500'
                              : item.daysLeft <= 7
                                ? 'text-amber-500'
                                : 'text-gray-400'
                          )}
                        />
                        {t('dashboard.daysLeft', { days: item.daysLeft })}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{t('dashboard.noDeadlines')}</p>
                  <Link href="/timeline">
                    <Button variant="link" className="mt-2">
                      {t('dashboard.viewAll')}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {t('dashboard.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                          activity.type === 'earn' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                        )}
                      >
                        {activity.type === 'earn' ? (
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Zap className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('dashboard.noRecentActivity')}</p>
                  <Link href="/schools">
                    <Button variant="link" className="mt-2">
                      {t('dashboard.startExploring')}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  );
}
