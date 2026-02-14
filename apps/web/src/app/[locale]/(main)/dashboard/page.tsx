'use client';

import { useTranslations } from 'next-intl';
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
    id: 'find-college',
    href: '/find-college',
    icon: Search,
    titleKey: 'dashboard.modules.findCollege',
    descKey: 'dashboard.modules.findCollegeDesc',
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

export default function DashboardPage() {
  const t = useTranslations();

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
                          className="text-[10px] px-1.5 py-0 border-rose-300 text-rose-600 bg-rose-50"
                        >
                          {t('dashboard.stats.reach')} {schoolTiers.reach}
                        </Badge>
                      )}
                      {schoolTiers.target > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 bg-blue-50"
                        >
                          {t('dashboard.stats.target')} {schoolTiers.target}
                        </Badge>
                      )}
                      {schoolTiers.safety > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 bg-emerald-50"
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
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t('dashboard.upcomingDeadlines')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.upcomingDeadlines && dashboard.upcomingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.upcomingDeadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{deadline.schoolName}</p>
                        <p className="text-xs text-muted-foreground">{deadline.round}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-2 shrink-0',
                          deadline.daysLeft <= 3
                            ? 'border-red-300 text-red-600 bg-red-50'
                            : deadline.daysLeft <= 7
                              ? 'border-amber-300 text-amber-600 bg-amber-50'
                              : 'border-gray-300 text-gray-600 bg-gray-50'
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            'w-3 h-3 mr-1',
                            deadline.daysLeft <= 3
                              ? 'text-red-500'
                              : deadline.daysLeft <= 7
                                ? 'text-amber-500'
                                : 'text-gray-400'
                          )}
                        />
                        {t('dashboard.daysLeft', { days: deadline.daysLeft })}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>{t('dashboard.noDeadlines')}</p>
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
                  <Link href="/find-college">
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
