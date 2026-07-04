'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { FadeInView } from '@/components/ui/motion';
import { Progress } from '@/components/ui/progress';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { useOnboardingProgress } from '@/hooks/use-onboarding-progress';
import { DASHBOARD_EVENTS, trackEvent } from '@/lib/analytics';
import { apiClient } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

import { AIErrorBoundary } from '@/components/features/ai-error-boundary';
import { OutcomePendingBanner } from '@/components/features/outcome/outcome-pending-banner';

// Above-the-fold surfaces stay statically imported — they're always
// visible and we don't want a chunk-fetch delay before paint.
import { DashboardCommandCenter } from './_components/dashboard-command-center';
import { DashboardEventsTimeline } from './_components/dashboard-events-timeline';
import { DashboardSetupProgress } from './_components/dashboard-setup-progress';
import { DashboardPipelineStrip } from './_components/dashboard-pipeline-strip';
import { DashboardQuickAsk } from './_components/dashboard-quick-ask';
import { DashboardTrending } from './_components/dashboard-trending';
import {
  createFallbackWorkbench,
  deriveStage,
  type DashboardData,
  type DashboardPriorityItem,
} from './_components/dashboard-workbench-model';

/*
 * 2026-05 Phase 5 #41: Lazy-load the below-the-fold surfaces.
 *
 * Why each is a great splitting candidate:
 *   - DashboardEssayCoach   → renders null when no essay AI runs exist
 *   - DashboardDecisionPanel→ renders null until user has decided schools
 *                             (Stage G — most users haven't reached it)
 *   - DashboardStats        → 9 counter tiles; in the batch-2 workbench
 *                             sidebar it renders default-open for
 *                             accounts with data, collapsed for brand-new
 *                             (empty-onboarding) accounts
 *   - DashboardWorkspaceHub → 13 lucide-react icons + 13 nav rows; large
 *
 * `ssr: true` (default) is kept so the components still pre-render with
 * `undefined` data (matching their existing SSR behaviour). The chunk
 * split is the win — they no longer bloat the dashboard's main JS bundle.
 *
 * No loading placeholder is set; each component already gracefully
 * handles its own undefined-data + empty-state cases (DecisionPanel /
 * EssayCoach return null; Hub renders collapsed, Stats renders per the
 * caller-supplied `defaultOpen`).
 */
const DashboardEssayCoach = dynamic(() =>
  import('./_components/dashboard-essay-coach').then((m) => ({
    default: m.DashboardEssayCoach,
  }))
);
const DashboardDecisionPanel = dynamic(() =>
  import('./_components/dashboard-decision-panel').then((m) => ({
    default: m.DashboardDecisionPanel,
  }))
);
const DashboardStats = dynamic(() =>
  import('./_components/dashboard-stats').then((m) => ({
    default: m.DashboardStats,
  }))
);
const DashboardWorkspaceHub = dynamic(() =>
  import('./_components/dashboard-workspace-hub').then((m) => ({
    default: m.DashboardWorkspaceHub,
  }))
);

export default function DashboardPage() {
  const t = useTranslations();
  const tTour = useTranslations('tour');
  const queryClient = useQueryClient();
  const { registerTour, startTour, hasCompletedTour } = useTour();
  const [isHydrated, setIsHydrated] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const authReady = useAuthReady();

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
      // 2026-05 Gap D closure: emit tour outcome events so funnel F7
      // (tour outcome → D7 retention correlation) can activate.
      // PII-safe — both callbacks emit no user data.
      onComplete: () => trackEvent(DASHBOARD_EVENTS.tourCompleted),
      onSkip: () => trackEvent(DASHBOARD_EVENTS.tourSkipped),
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
    enabled: authReady,
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

  // 2026-05 dashboard redesign batch 4: derive the application stage from
  // real pipeline data. Only `stage.parallel` is consumed by the UI (a
  // calm "other tracks in progress" hint in the CommandCenter hero) — the
  // 5-stage `primary` label is intentionally NOT rendered as a chip
  // (redundant with the focus card; a behaviour-derived label reads as a
  // judgement). See the deferred-items debate.
  const stage = useMemo(
    () =>
      deriveStage({
        targetSchoolCount: schoolCount,
        essayCount: stableDashboard?.profile.essayCount ?? 0,
        completeness,
        pipeline: workbench.pipeline,
      }),
    [schoolCount, stableDashboard?.profile.essayCount, completeness, workbench.pipeline]
  );

  return (
    // 2026-05 dashboard redesign batch 2: `variant="admin"` (fluid, max
    // 1600px). Replaces the `variant="tool" maxWidth="fluid"
    // className="max-w-[1500px]"` combo — overriding max-width via
    // className is the anti-pattern apps/web/CLAUDE.md explicitly calls
    // out (depends on tw-merge priority; semantically backwards).
    <PageContainer variant="admin">
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

      {/*
        2026-05 dashboard redesign batch 2: a single `FadeInView` around
        the whole body replaces the previous 7 per-surface `motion.div`s
        with hand-tuned staggered delays (0.03–0.05, not even monotonic).
        One calm entrance, no cascade. FadeInView also honours
        `prefers-reduced-motion` — the raw motion.divs did not, so this
        also fixes an a11y regression. `data-tour` anchors moved onto
        plain wrapper divs so the first-visit tour still finds its
        targets (driver.js silently skips missing selectors).
      */}
      <FadeInView direction="up" className="space-y-6">
        {/* M6: Outcome reporting prompt — renders null when the user has
            no unreported predictions, so it doesn't add empty space. */}
        <OutcomePendingBanner />

        {/*
          2026-05 dashboard redesign batch 2: two-column workbench.
          MAIN column (1fr) holds the "what do I do next" surfaces; the
          de-ranked SIDEBAR (~21rem) holds reference + navigation. Below
          `lg` the grid collapses to one column — MAIN first, sidebar
          last. `min-w-0` on the grid container AND both children
          prevents a long string in either column from clipping the
          other at the viewport edge (the PR #214/#215/#217 incident).
        */}
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(19rem,22vw,21rem)]">
          {/* MAIN column — tier 1+2: next-action surfaces. The three
              conditional surfaces below render null when the user has
              no data; a null grid/flex child collapses cleanly, so a
              new user simply sees CommandCenter alone (no empty hole). */}
          <div className="min-w-0 space-y-6">
            {/*
              Events timeline overview (batch-2, feedback 5e). At-a-glance
              strip of the next big milestones — school deadlines +
              competitions + exams — ABOVE the command center, so the user
              first sees "the few big things coming up", then the specific
              next action + to-do below. Renders null when there are none.
            */}
            <DashboardEventsTimeline items={workbench.deadlineStream} />
            <div data-tour="dashboard-command-center">
              <DashboardCommandCenter
                workbench={workbench}
                completingTaskId={completingTaskId}
                onCompleteTask={(item) => toggleTimelineTask.mutate(item)}
                completeness={completeness}
                schoolCount={schoolCount}
                predictionsCount={predictionsCount}
                casesCount={casesCount}
                // 2026-05 Phase 2.7 #28: drives grade-aware rhythm message.
                grade={stableDashboard?.profile.grade}
                // 2026-05 batch 4: only `stage.parallel` is consumed.
                stage={stage}
              />
            </div>

            {/*
              Quick Ask AI — profile-aware prompts folded into the action
              column, right under the command center. Dashboard redesign:
              the AI box is no longer the full-width top focus (users don't
              want "ask AI" to be the homepage headline), but it stays where
              the next action is, and its suggestions are profile-aware.
              AIErrorBoundary so an AI failure can't crash the dashboard.
            */}
            <div data-tour="dashboard-quick-ask">
              <AIErrorBoundary feature="agent-chat">
                <DashboardQuickAsk
                  personalizedSuggestions={stableDashboard?.quickAskSuggestions ?? null}
                />
              </AIErrorBoundary>
            </div>

            {/*
              Trending discussions (feedback 5f). The hottest community
              threads by engagement — replaces the earlier non-ranked
              "belonging" on-ramp per the user's explicit request for a
              trending board. Renders its own empty state, so it never
              leaves an empty hole for a new user.
            */}
            <DashboardTrending />

            {/*
              Pipeline strip — renders null unless at least one school
              is past IN_PROGRESS (extracted from CommandCenter in batch 1).
            */}
            <DashboardPipelineStrip pipeline={workbench.pipeline} />

            {/*
              Latest essay AI feedback inline. Renders only when there's
              at least one AI run (data === null otherwise). Brings AI
              Layer 3 into the dashboard as a 1-click path back to essay
              work — matches Cialfo's best practice (22-product research).
            */}
            <DashboardEssayCoach data={stableDashboard?.essayCoach} />

            {/*
              Decision Hub (Stage G). Renders only when the user has ≥1
              decided school (ACCEPTED/WAITLISTED/REJECTED/WITHDRAWN).
              22-product research showed 0/22 platforms handle this stage
              well — Lumni's differentiator.
            */}
            {/* Pass the resolved `workbench.pipeline` (always defined —
                see the useMemo fallback above) rather than reaching into
                `stableDashboard?.workbench.pipeline`, which would throw if
                `stableDashboard` existed but `workbench` was undefined. */}
            <DashboardDecisionPanel pipeline={workbench.pipeline} />
          </div>

          {/*
            SIDEBAR column — tier 3: de-ranked reference + navigation.
            No tinted container wrapper: a card-on-`bg-muted` nesting
            collapses in dark mode (the two tones are near-neighbours on
            the OKLCH dark scale). The narrow column + collapsed
            accordions already read as secondary. DashboardStats renders
            default-OPEN for accounts that have data, so the sidebar
            shows a real "where am I" snapshot instead of two empty
            collapsed bars — but stays COLLAPSED for brand-new
            (empty-onboarding) accounts, so the redesign's zero-
            suppression isn't undone by a sidebar wall of `0`/`—`. The
            Hub stays collapsed (secondary navigation). On mobile the
            whole column stacks below MAIN.
          */}
          <aside className="min-w-0 space-y-4">
            {/*
              Setup progress (batch-2, feedback 5c). The old 5-card readiness
              grid was demoted from the hero to this compact sidebar card —
              a small progress bar + one tight row per item, still one-click
              into each page. Renders null when there are no readiness items.
            */}
            <DashboardSetupProgress workbench={workbench} />
            <DashboardStats dashboard={stableDashboard} defaultOpen={!isEmptyOnboarding} />
            <div data-tour="dashboard-hub">
              <DashboardWorkspaceHub />
            </div>
          </aside>
        </div>
      </FadeInView>
    </PageContainer>
  );
}
