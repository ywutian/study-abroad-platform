'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, LayoutDashboard } from 'lucide-react';
import { profileRoutes, userRoutes } from '@study-abroad/shared';

import { QuickExperience } from '@/components/features/onboarding/quick-experience';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

import { DashboardActivity } from './_components/dashboard-activity';
import { DashboardCommandCenter } from './_components/dashboard-command-center';
import {
  createFallbackWorkbench,
  type DashboardData,
  type DashboardPriorityItem,
} from './_components/dashboard-workbench-model';

export default function DashboardPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [isHydrated, setIsHydrated] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

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
        .post(profileRoutes.onboarding(), data)
        .then(() => {
          sessionStorage.removeItem('pendingOnboarding');
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        })
        .catch(() => {
          // Keep the payload for the next dashboard recovery attempt.
        });
    } catch {
      sessionStorage.removeItem('pendingOnboarding');
    }
  }, [queryClient]);

  const toggleTimelineTask = useMutation({
    mutationFn: (item: DashboardPriorityItem) => {
      if (item.mutation?.type !== 'timeline-task-toggle') {
        return Promise.resolve();
      }
      return apiClient.post(item.mutation.endpoint);
    },
    onMutate: (item) => {
      setCompletingTaskId(item.id.replace(/^task-/, ''));
    },
    onSettled: () => {
      setCompletingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
    },
  });

  const stableDashboard = isHydrated ? dashboard : undefined;
  const completeness = stableDashboard?.profile.completeness ?? 0;
  const { showIndicator, gapCount } = useOnboardingProgress();
  const schoolCount = stableDashboard?.profile.targetSchoolCount ?? 0;
  const schoolTiers = stableDashboard?.profile.schoolTiers ?? { reach: 0, target: 0, safety: 0 };
  const pendingTotal = stableDashboard?.pendingTasks.total ?? 0;
  const profileGaps = stableDashboard?.pendingTasks.profileGaps ?? [];
  const effectivePending = pendingTotal > 0 ? pendingTotal : profileGaps.length;
  const displayName = isHydrated
    ? dashboard?.user.nickname || dashboard?.user.email?.split('@')[0] || t('dashboard.user')
    : t('dashboard.user');

  const workbench = useMemo(
    () =>
      stableDashboard?.workbench ??
      createFallbackWorkbench(stableDashboard, {
        profile: t('dashboard.commandCenter.signals.profile'),
        schools: t('dashboard.commandCenter.signals.schools'),
        essays: t('dashboard.commandCenter.signals.essays'),
        timeline: t('dashboard.modules.timeline'),
        profileDesc: t('dashboard.commandCenter.actions.profileDesc'),
        schoolsDesc: t('dashboard.commandCenter.actions.schoolsDesc'),
        essaysDesc: t('dashboard.commandCenter.actions.essaysDesc'),
        timelineDesc: t('dashboard.commandCenter.actions.deadlinesDesc', {
          count: effectivePending,
        }),
        profileAction: t('dashboard.commandCenter.actions.profile'),
        schoolAction: t('dashboard.commandCenter.actions.schools'),
        essayAction: t('dashboard.commandCenter.actions.essays'),
        timelineAction: t('dashboard.commandCenter.actions.deadlines'),
        predictionAction: t('dashboard.commandCenter.actions.review'),
        predictionDesc: t('dashboard.commandCenter.actions.reviewDesc'),
      }),
    [effectivePending, stableDashboard, t]
  );

  return (
    <PageContainer variant="tool" maxWidth="fluid" className="max-w-[1500px]">
      <PageHeader
        title={t('dashboard.welcome', { name: displayName })}
        description={t('dashboard.subtitle')}
        icon={LayoutDashboard}
        variant="tool"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/timeline">
              <CalendarClock className="h-4 w-4" />
              {t('dashboard.modules.timeline')}
            </Link>
          </Button>
        }
      />
      <QuickExperience />

      {isHydrated && showIndicator && (
        <Link href="/profile">
          <div className="mb-6 flex cursor-pointer items-center gap-3 rounded-[var(--theme-radius-card)] border border-warning/25 bg-warning/10 px-4 py-2.5 transition-colors hover:bg-warning/15">
            <Progress value={completeness} className="h-1.5 max-w-[120px] flex-1" />
            <span className="text-sm text-muted-foreground">
              {t('dashboard.onboarding.progress', { pct: completeness })}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              · {t('dashboard.onboarding.remaining', { count: gapCount })}
            </span>
            <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
        </Link>
      )}

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <DashboardCommandCenter
            workbench={workbench}
            completingTaskId={completingTaskId}
            onCompleteTask={(item) => toggleTimelineTask.mutate(item)}
            completeness={completeness}
            schoolTiers={schoolTiers}
            schoolCount={schoolCount}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <DashboardActivity activities={stableDashboard?.recentActivity ?? []} />
        </motion.div>
      </div>
    </PageContainer>
  );
}
