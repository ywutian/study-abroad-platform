'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { LayoutDashboard, User, ArrowRight } from 'lucide-react';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import { Progress } from '@/components/ui/progress';
import { QuickExperience } from '@/components/features/onboarding/quick-experience';
import { DashboardStats } from './_components/dashboard-stats';
import { DashboardModules } from './_components/dashboard-modules';
import { DashboardDeadlines, type TodoItem } from './_components/dashboard-deadlines';
import { DashboardActivity } from './_components/dashboard-activity';

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
    return {
      grade: 'A',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    };
  if (completeness >= 75)
    return { grade: 'B+', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10' };
  if (completeness >= 60) return { grade: 'B', color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
  if (completeness >= 40)
    return { grade: 'C', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' };
  return { grade: 'D', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10' };
}

export default function DashboardPage() {
  const t = useTranslations();
  const locale = useLocale();

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>('/users/me/dashboard'),
  });

  const completeness = dashboard?.profile.completeness ?? 0;
  const { showIndicator, gapCount } = useOnboardingProgress();
  const schoolCount = dashboard?.profile.targetSchoolCount ?? 0;
  const schoolTiers = dashboard?.profile.schoolTiers ?? { reach: 0, target: 0, safety: 0 };
  const pendingTotal = dashboard?.pendingTasks.total ?? 0;
  const profileGaps = dashboard?.pendingTasks.profileGaps ?? [];
  const grade = getProfileGrade(completeness);
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
      <PageHeader
        title={t('dashboard.welcome', {
          name: dashboard?.user.email?.split('@')[0] || t('dashboard.user'),
        })}
        description={t('dashboard.subtitle')}
        icon={LayoutDashboard}
        color="slate"
      />
      <QuickExperience />

      {/* Mini progress banner — shown when profile is incomplete */}
      {showIndicator && (
        <Link href="/profile">
          <div className="flex items-center gap-3 rounded-lg border bg-amber-500/5 border-amber-500/20 px-4 py-2.5 hover:bg-amber-500/10 transition-colors cursor-pointer">
            <Progress value={completeness} className="h-1.5 flex-1 max-w-[120px]" />
            <span className="text-sm text-muted-foreground">
              {t('dashboard.onboarding.progress', { pct: completeness })}
            </span>
            <span className="text-xs text-muted-foreground">
              · {t('dashboard.onboarding.remaining', { count: gapCount })}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          </div>
        </Link>
      )}

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
        >
          <DashboardStats
            completeness={completeness}
            schoolCount={schoolCount}
            schoolTiers={schoolTiers}
            effectivePending={effectivePending}
            grade={grade}
          />
        </motion.div>

        {/* 4 Main Module Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DashboardModules />
        </motion.div>

        {/* Upcoming Deadlines + Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <DashboardDeadlines todoList={todoList} />
          <DashboardActivity activities={dashboard?.recentActivity ?? []} />
        </motion.div>
      </div>
    </PageContainer>
  );
}
