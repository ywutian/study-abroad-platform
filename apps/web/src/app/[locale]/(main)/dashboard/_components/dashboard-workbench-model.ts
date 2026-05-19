'use client';

// 2026-05: Dashboard contract types live in @study-abroad/shared so API +
// Web can never silently drift on the workbench shape. Re-export here
// for backward compatibility with consumers that import from this file
// (CommandCenter, PipelineStrip, page.tsx, tests).
export type {
  DashboardData,
  DashboardDeadlineItem,
  DashboardPipeline,
  DashboardPriorityItem,
  DashboardPriorityKind,
  DashboardReadinessItem,
  DashboardReadinessStatus,
  DashboardRecentDecision,
  DashboardSeverity,
  DashboardSummary,
  // 2026-05 Phase 2.5c: unified visual tone — collapses
  // DashboardSeverity + DashboardReadinessStatus to 4 colors.
  DashboardTone,
  DashboardWorkbench,
} from '@study-abroad/shared';
export { toneFromReadinessStatus, toneFromSeverity } from '@study-abroad/shared';

import type {
  DashboardData,
  DashboardPriorityItem,
  DashboardWorkbench,
} from '@study-abroad/shared';

// 2026-05 dashboard redesign batch 3: `getProfileGrade` (profile
// completeness → A–D letter grade) was REMOVED. It was a third encoding
// of `profile.completeness` — already surfaced as `profileContribution/40`
// on the readiness row and as a % in the onboarding-progress banner.
// A letter grade on a completeness metric also reads like an academic
// transcript grade, an emotional misfire for anxious applicants. The
// dashboard now keeps one honest representation per number.

// 2026-05: `buildTodoList` and `TodoItem` were removed. Their consumer
// (DashboardDeadlines card) is deleted; deadline display now lives in
// CommandCenter.deadlineStream, which is constructed by the API.

export function createFallbackWorkbench(
  dashboard: DashboardData | undefined,
  copy: {
    profile: string;
    schools: string;
    essays: string;
    timeline: string;
    prediction: string;
    profileDesc: string;
    schoolsDesc: string;
    essaysDesc: string;
    timelineDesc: string;
    predictionItemDescReady: string;
    predictionItemDescPending: string;
    predictionItemDescBlocked: string;
    profileAction: string;
    schoolAction: string;
    essayAction: string;
    timelineAction: string;
    predictionAction: string;
    predictionDesc: string;
  }
): DashboardWorkbench {
  const completeness = dashboard?.profile.completeness ?? 0;
  const schoolCount = dashboard?.profile.targetSchoolCount ?? 0;
  const essayCount = dashboard?.profile.essayCount ?? 0;
  const predictionsCount = dashboard?.stats.predictions ?? 0;
  const pending = dashboard?.pendingTasks.total ?? dashboard?.pendingTasks.profileGaps.length ?? 0;
  const due30 =
    (dashboard?.upcomingDeadlines ?? []).filter((item) => item.daysLeft <= 30).length +
    (dashboard?.upcomingPersonalEvents ?? []).filter((item) => item.daysLeft <= 30).length;
  const balancedSchoolList = Boolean(
    dashboard &&
    dashboard.profile.schoolTiers.reach > 0 &&
    dashboard.profile.schoolTiers.target > 0 &&
    dashboard.profile.schoolTiers.safety > 0
  );
  // ── Readiness contribution scores (per-item breakdown of total score) ──
  // Profile up to 40 pts (40% of total)
  // Schools up to 20 pts (20% of total, scaled by min(schoolCount/6, 1))
  // Essays up to 15 pts (binary: has at least 1 essay)
  // Timeline up to 10 pts (10 when no pending, scales down with pending count)
  // Prediction up to 15 pts (binary: has run prediction at least once)
  // The five contributions sum to the Readiness total — users can audit it.
  const profileContribution = Math.round(completeness * 0.4);
  const schoolsContribution = Math.round(Math.min(schoolCount / 6, 1) * 20);
  const essaysContribution = essayCount > 0 ? 15 : 0;
  const timelineContribution = pending === 0 ? 10 : Math.max(0, 8 - Math.min(pending, 8));
  const predictionContribution = predictionsCount > 0 ? 15 : 0;
  const score = Math.min(
    100,
    profileContribution +
      schoolsContribution +
      essaysContribution +
      timelineContribution +
      predictionContribution
  );
  // Prediction is only actionable once the user has at least one school AND
  // a passable profile. If those preconditions aren't met, the row should
  // signal "blocked by upstream signals" rather than "go run prediction".
  const predictionEligible = schoolCount > 0 && completeness >= 40;
  // Fallback (used only when the API didn't return a workbench) has no
  // timeline-task data, so the if/else chain below pushes at most one
  // item — the API's severity-then-deadline sort in buildPriorityQueue
  // has no analogue to mirror here.
  const priorityQueue: DashboardPriorityItem[] = [];

  if (completeness < 75) {
    priorityQueue.push({
      id: 'fallback-profile',
      kind: 'profile',
      severity: completeness < 40 ? 'critical' : 'warning',
      title: copy.profileAction,
      description: copy.profileDesc,
      href: '/profile',
    });
  } else if (schoolCount < 6 || !balancedSchoolList) {
    priorityQueue.push({
      id: 'fallback-schools',
      kind: 'school-list',
      severity: schoolCount === 0 ? 'critical' : 'warning',
      title: copy.schoolAction,
      description: copy.schoolsDesc,
      href: '/schools',
    });
  } else if (essayCount === 0) {
    priorityQueue.push({
      id: 'fallback-essays',
      kind: 'essay',
      severity: 'warning',
      title: copy.essayAction,
      description: copy.essaysDesc,
      href: '/essays',
    });
  } else if (pending > 0 || due30 > 0) {
    priorityQueue.push({
      id: 'fallback-timeline',
      kind: 'timeline',
      severity: due30 > 0 ? 'warning' : 'normal',
      title: copy.timelineAction,
      description: copy.timelineDesc,
      href: '/timeline',
    });
  } else {
    priorityQueue.push({
      id: 'fallback-prediction',
      kind: 'prediction',
      severity: 'success',
      title: copy.predictionAction,
      description: copy.predictionDesc,
      href: '/prediction',
    });
  }

  return {
    readiness: {
      score,
      status: score >= 85 ? 'ready' : score >= 55 ? 'attention' : 'blocked',
      items: [
        {
          key: 'profile',
          label: copy.profile,
          value: `${profileContribution}/40`,
          contributionScore: profileContribution,
          contributionDenom: 40,
          status: completeness >= 75 ? 'ready' : completeness >= 40 ? 'attention' : 'blocked',
          href: '/profile',
          description: copy.profileDesc,
        },
        {
          key: 'schools',
          label: copy.schools,
          value: `${schoolsContribution}/20`,
          contributionScore: schoolsContribution,
          contributionDenom: 20,
          status:
            schoolCount >= 6 && balancedSchoolList
              ? 'ready'
              : schoolCount > 0
                ? 'attention'
                : 'blocked',
          href: '/schools',
          description: copy.schoolsDesc,
        },
        {
          key: 'essays',
          label: copy.essays,
          value: `${essaysContribution}/15`,
          contributionScore: essaysContribution,
          contributionDenom: 15,
          status: essayCount > 0 ? 'ready' : 'attention',
          href: '/essays',
          description: copy.essaysDesc,
        },
        {
          key: 'timeline',
          label: copy.timeline,
          value: `${timelineContribution}/10`,
          contributionScore: timelineContribution,
          contributionDenom: 10,
          status: pending === 0 ? 'ready' : 'attention',
          href: '/timeline',
          description: copy.timelineDesc,
        },
        {
          key: 'prediction',
          label: copy.prediction,
          value: `${predictionContribution}/15`,
          contributionScore: predictionContribution,
          contributionDenom: 15,
          status: predictionsCount > 0 ? 'ready' : predictionEligible ? 'attention' : 'blocked',
          href: '/prediction',
          description:
            predictionsCount > 0
              ? copy.predictionItemDescReady
              : predictionEligible
                ? copy.predictionItemDescPending
                : copy.predictionItemDescBlocked,
        },
      ],
    },
    metrics: {
      due7:
        (dashboard?.upcomingDeadlines ?? []).filter((item) => item.daysLeft <= 7).length +
        (dashboard?.upcomingPersonalEvents ?? []).filter((item) => item.daysLeft <= 7).length,
      due30,
      overdueTasks: 0,
      missingTimelineCount: 0,
      balancedSchoolList,
    },
    priorityQueue,
    deadlineStream: [],
  };
}
