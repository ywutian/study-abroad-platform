'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/lib/i18n/navigation';
import { motion } from 'framer-motion';
import { PageContainer, PageHeader } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { userRoutes } from '@study-abroad/shared';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  School,
  User,
} from 'lucide-react';
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
    nickname?: string;
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
      color: 'text-success',
      bgColor: 'bg-success/10',
    };
  if (completeness >= 75) return { grade: 'B+', color: 'text-primary', bgColor: 'bg-primary/10' };
  if (completeness >= 60) return { grade: 'B', color: 'text-primary', bgColor: 'bg-primary/10' };
  if (completeness >= 40) return { grade: 'C', color: 'text-warning', bgColor: 'bg-warning/10' };
  return { grade: 'D', color: 'text-destructive', bgColor: 'bg-destructive/10' };
}

function NextBestAction({
  completeness,
  schoolCount,
  essayCount,
  deadlineCount,
  profileGaps,
}: {
  completeness: number;
  schoolCount: number;
  essayCount: number;
  deadlineCount: number;
  profileGaps: string[];
}) {
  const t = useTranslations();

  const action =
    completeness < 75
      ? {
          href: '/profile',
          icon: User,
          label: t('dashboard.commandCenter.actions.profile'),
          description: t('dashboard.commandCenter.actions.profileDesc'),
          cta: t('dashboard.editProfile'),
        }
      : schoolCount < 6
        ? {
            href: '/schools',
            icon: School,
            label: t('dashboard.commandCenter.actions.schools'),
            description: t('dashboard.commandCenter.actions.schoolsDesc'),
            cta: t('dashboard.modules.schools'),
          }
        : essayCount === 0
          ? {
              href: '/essays',
              icon: FileText,
              label: t('dashboard.commandCenter.actions.essays'),
              description: t('dashboard.commandCenter.actions.essaysDesc'),
              cta: t('dashboard.modules.essays'),
            }
          : deadlineCount > 0
            ? {
                href: '/timeline',
                icon: CalendarClock,
                label: t('dashboard.commandCenter.actions.deadlines'),
                description: t('dashboard.commandCenter.actions.deadlinesDesc', {
                  count: deadlineCount,
                }),
                cta: t('dashboard.modules.timeline'),
              }
            : {
                href: '/prediction',
                icon: CheckCircle2,
                label: t('dashboard.commandCenter.actions.review'),
                description: t('dashboard.commandCenter.actions.reviewDesc'),
                cta: t('dashboard.modules.prediction'),
              };

  const ActionIcon = action.icon;
  const signals = [
    {
      label: t('dashboard.commandCenter.signals.profile'),
      value: `${completeness}%`,
      complete: completeness >= 75,
    },
    {
      label: t('dashboard.commandCenter.signals.schools'),
      value: String(schoolCount),
      complete: schoolCount >= 6,
    },
    {
      label: t('dashboard.commandCenter.signals.essays'),
      value: String(essayCount),
      complete: essayCount > 0,
    },
    {
      label: t('dashboard.commandCenter.signals.deadlines'),
      value: String(deadlineCount),
      complete: deadlineCount === 0,
    },
  ];

  return (
    <Card className="overflow-hidden border-primary/20 bg-[color:var(--theme-card-bg)]">
      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-[var(--theme-radius-badge)]">
                {t('dashboard.commandCenter.label')}
              </Badge>
              {profileGaps.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t('dashboard.commandCenter.gapCount', { count: profileGaps.length })}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] bg-primary/10 text-primary">
                    <ActionIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">{action.label}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>
              </div>
              <Button asChild className="shrink-0 gap-2">
                <Link href={action.href}>
                  {action.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-2 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-3">
            {signals.map((signal) => (
              <div key={signal.label} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      'h-2 w-2 shrink-0 rounded-full',
                      signal.complete ? 'bg-success' : 'bg-warning',
                    ].join(' ')}
                  />
                  <span className="truncate text-sm text-muted-foreground">{signal.label}</span>
                </div>
                <span className="font-medium tabular-nums">{signal.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>(userRoutes.dashboard()),
  });

  // Consume pendingOnboarding from sessionStorage (fallback from registration)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('pendingOnboarding');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      apiClient
        .post('/profiles/onboarding', data)
        .then(() => {
          sessionStorage.removeItem('pendingOnboarding');
        })
        .catch(() => {
          // Keep the payload for the next dashboard recovery attempt.
        });
    } catch {
      sessionStorage.removeItem('pendingOnboarding');
    }
  }, []);

  const stableDashboard = isHydrated ? dashboard : undefined;
  const completeness = stableDashboard?.profile.completeness ?? 0;
  const { showIndicator, gapCount } = useOnboardingProgress();
  const schoolCount = stableDashboard?.profile.targetSchoolCount ?? 0;
  const schoolTiers = stableDashboard?.profile.schoolTiers ?? { reach: 0, target: 0, safety: 0 };
  const pendingTotal = stableDashboard?.pendingTasks.total ?? 0;
  const profileGaps = stableDashboard?.pendingTasks.profileGaps ?? [];
  const grade = getProfileGrade(completeness);
  const effectivePending = pendingTotal > 0 ? pendingTotal : profileGaps.length;
  const displayName = isHydrated
    ? dashboard?.user.nickname || dashboard?.user.email?.split('@')[0] || t('dashboard.user')
    : t('dashboard.user');

  const todoList = useMemo<TodoItem[]>(() => {
    const items: TodoItem[] = [];
    const dateFmt = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });

    for (const d of stableDashboard?.upcomingDeadlines ?? []) {
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

    for (const ev of stableDashboard?.upcomingPersonalEvents ?? []) {
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
  }, [stableDashboard?.upcomingDeadlines, stableDashboard?.upcomingPersonalEvents, locale]);

  return (
    <PageContainer variant="tool">
      <PageHeader
        title={t('dashboard.welcome', { name: displayName })}
        description={t('dashboard.subtitle')}
        icon={LayoutDashboard}
        variant="tool"
      />
      <QuickExperience />

      {/* Mini progress banner — shown when profile is incomplete */}
      {isHydrated && showIndicator && (
        <Link href="/profile">
          <div className="flex cursor-pointer items-center gap-3 rounded-[var(--theme-radius-card)] border border-warning/25 bg-warning/10 px-4 py-2.5 transition-colors hover:bg-warning/15">
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <NextBestAction
            completeness={completeness}
            schoolCount={schoolCount}
            essayCount={stableDashboard?.profile.essayCount ?? 0}
            deadlineCount={todoList.filter((item) => item.daysLeft <= 30).length}
            profileGaps={profileGaps}
          />
        </motion.div>

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
          <DashboardActivity activities={stableDashboard?.recentActivity ?? []} />
        </motion.div>
      </div>
    </PageContainer>
  );
}
