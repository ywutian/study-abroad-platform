'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, LayoutDashboard } from 'lucide-react';
import { profileRoutes, userRoutes } from '@study-abroad/shared';

import { QuickExperience } from '@/components/features/onboarding/quick-experience';
import {
  getDashboardTourSteps,
  TOURS,
  useTour,
} from '@/components/features/onboarding/tour-provider';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

import { AIErrorBoundary } from '@/components/features/ai-error-boundary';

import { DashboardActivity } from './_components/dashboard-activity';
import { DashboardCommandCenter } from './_components/dashboard-command-center';
import { DashboardDecisionPanel } from './_components/dashboard-decision-panel';
import { DashboardEssayCoach } from './_components/dashboard-essay-coach';
import { DashboardQuickAsk } from './_components/dashboard-quick-ask';
// 2026-05 Phase 2.5b: stats extracted from Hub into its own card.
import { DashboardStats } from './_components/dashboard-stats';
import { DashboardWorkspaceHub } from './_components/dashboard-workspace-hub';
import {
  createFallbackWorkbench,
  type DashboardData,
  type DashboardPriorityItem,
} from './_components/dashboard-workbench-model';

export default function DashboardPage() {
  const t = useTranslations();
  const tTour = useTranslations('tour');
  const queryClient = useQueryClient();
  const { registerTour, startTour, hasCompletedTour } = useTour();
  const [isHydrated, setIsHydrated] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 2026-05 Phase 2.7 #27: Register + auto-start the dashboard tour on
  // first visit. driver.js skips steps whose target [data-tour] isn't
  // present (e.g., DecisionPanel doesn't render for new accounts), so
  // the tour gracefully degrades for any subset of dashboard surfaces.
  useEffect(() => {
    if (!isHydrated) return;
    registerTour({
      id: TOURS.DASHBOARD,
      steps: getDashboardTourSteps(tTour),
    });
    // Auto-start only if not already completed AND the page has had a
    // tick to render so targets exist. 800ms is enough for animations
    // + suspense without feeling laggy.
    if (!hasCompletedTour(TOURS.DASHBOARD)) {
      const handle = setTimeout(() => startTour(TOURS.DASHBOARD), 800);
      return () => clearTimeout(handle);
    }
  }, [isHydrated, registerTour, startTour, hasCompletedTour, tTour]);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardData>(userRoutes.dashboard()),
    // 2026-05 Phase 1.5 #21: dashboard is highly mutable (every school
    // add / prediction run / task toggle changes it). Override the
    // global 5-min staleTime to 30s so users see fresh data without
    // hammering the API on every focus.
    staleTime: 30_000,
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
  const predictionsCount = stableDashboard?.stats.predictions ?? 0;
  const casesCount = stableDashboard?.stats.cases ?? 0;
  // 2026-05 Phase 1 design piggyback #9: "双欢迎"文案修复 — when the
  // CommandCenter shows the empty-onboarding hero ("欢迎来到 Lumni"),
  // PageHeader must NOT also say "欢迎回来" — the two together looked
  // self-contradictory in the production screenshot.
  const isEmptyOnboarding =
    completeness === 0 && schoolCount === 0 && predictionsCount === 0 && casesCount === 0;
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
        prediction: t('dashboard.commandCenter.signals.prediction'),
        profileDesc: t('dashboard.commandCenter.actions.profileDesc'),
        schoolsDesc: t('dashboard.commandCenter.actions.schoolsDesc'),
        essaysDesc: t('dashboard.commandCenter.actions.essaysDesc'),
        timelineDesc: t('dashboard.commandCenter.actions.deadlinesDesc', {
          count: effectivePending,
        }),
        predictionItemDescReady: t('dashboard.commandCenter.actions.predictionItemDescReady'),
        predictionItemDescPending: t('dashboard.commandCenter.actions.predictionItemDescPending'),
        predictionItemDescBlocked: t('dashboard.commandCenter.actions.predictionItemDescBlocked'),
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
        title={t(isEmptyOnboarding ? 'dashboard.welcomeFirst' : 'dashboard.welcome', {
          name: displayName,
        })}
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
        {/*
          Quick Ask AI — collapses 3 clicks (icon → wait → type) into 1.
          Submitting opens the global FloatingChat with the message
          prefilled. Full-width strip just under the page header makes
          AI the default action surface, addressing the "everything
          requires too many clicks" feedback.
        */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          data-tour="dashboard-quick-ask"
        >
          {/* 2026-05 Phase 1.5 #17: QuickAsk wraps an AI feature (the
              FloatingChat bridge). An AI failure should NOT crash the
              entire dashboard, so wrap with AIErrorBoundary like every
              other AI surface on the platform. */}
          <AIErrorBoundary feature="agent-chat">
            <DashboardQuickAsk />
          </AIErrorBoundary>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          data-tour="dashboard-command-center"
        >
          <DashboardCommandCenter
            workbench={workbench}
            completingTaskId={completingTaskId}
            onCompleteTask={(item) => toggleTimelineTask.mutate(item)}
            completeness={completeness}
            schoolTiers={schoolTiers}
            schoolCount={schoolCount}
            predictionsCount={predictionsCount}
            casesCount={casesCount}
          />
        </motion.div>

        {/*
          2026-05 Phase 2c: Latest essay AI feedback inline. Renders only
          when there's at least one AI run (data === null otherwise).
          Brings AI Layer 3 (essay feedback) into the dashboard as a
          1-click path back to continued essay work — matches Cialfo's
          best practice in the 22-product competitor research.
        */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <DashboardEssayCoach data={stableDashboard?.essayCoach} />
        </motion.div>

        {/*
          2026-05 Phase 2a: Decision Hub (Stage G). Renders only when
          the user has ≥1 decided school (ACCEPTED/WAITLISTED/REJECTED/
          WITHDRAWN). Reuses the same `pipeline.recentDecisions` data
          as PipelineStrip but presents it as a fuller decision-phase
          surface (per-status tiles + celebratory framing + waitlist
          coaching hint). 22-product research showed 0/22 platforms
          handle this stage well — Lumni's differentiator.
        */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.045 }}
        >
          <DashboardDecisionPanel pipeline={stableDashboard?.workbench.pipeline ?? null} />
        </motion.div>

        {/*
          2026-05 Phase 2.5b: Dashboard Stats — "where am I" numbers
          (followers / cases / predictions / points + Phase 2b signals:
          assessment / recommendations / verification / chat unread).
          Sits BEFORE Workspace Hub so the user sees their state first,
          then chooses navigation. Previously this lived inside the Hub
          as a 4th column, which mixed nav with data display.
        */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <DashboardStats dashboard={stableDashboard} />
        </motion.div>

        {/*
          Workspace Hub — surfaces all 12 user-facing navigation
          destinations (Forum, Hall, Teams, Followers, Vault, Resume,
          Assessment, etc.) so users don't have to hunt in the global
          Header. 3 columns mirror Header's taxonomy: Research / Social
          / Tools. (Stats column was extracted in 2.5b — see above.)
        */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          data-tour="dashboard-hub"
        >
          <DashboardWorkspaceHub />
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
