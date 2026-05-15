import type { TimelineResponse } from '@/types/timeline';
import type { AIAnalysis, Profile, SchoolListItem, TieredRecommendations } from './types';

export type WorkspaceActionId =
  | 'complete-profile'
  | 'add-schools'
  | 'sync-requirements'
  | 'add-safety'
  | 'review-deadlines'
  | 'generate-advice';

export type WorkspaceActionIntent = 'navigate' | 'sync' | 'analysis' | 'recommendations';
export type WorkspaceHealthStatus = 'good' | 'warning' | 'risk';
export type ApplicationUrgency =
  | 'overdue'
  | 'due7'
  | 'due30'
  | 'missingTimeline'
  | 'missingEssay'
  | 'ready';

export interface WorkspaceAction {
  id: WorkspaceActionId;
  href?: string;
  intent: WorkspaceActionIntent;
}

export interface ReadinessSignal {
  id: 'profile' | 'schools' | 'essays' | 'deadlines';
  value: string;
  status: WorkspaceHealthStatus;
}

export interface SchoolApplicationRow {
  id: string;
  schoolId: string;
  schoolName: string;
  tier: 'SAFETY' | 'TARGET' | 'REACH';
  round: string;
  deadline?: string;
  daysUntil: number | null;
  essayPromptCount: number;
  hasTimeline: boolean;
  tasksTotal: number;
  tasksRemaining: number;
  predictionProbability: number | null;
  urgency: ApplicationUrgency;
  nextStep: WorkspaceActionId | 'write-essays' | 'run-prediction' | 'view-timeline';
}

export interface HealthCheck {
  id: 'profile' | 'balance' | 'essays' | 'deadlines';
  status: WorkspaceHealthStatus;
  action: WorkspaceAction;
  meta: Record<string, number>;
}

export interface ApplicationWorkspaceModel {
  profileScore: number;
  schoolCount: number;
  tierCounts: { reach: number; target: number; safety: number };
  essayPromptCount: number;
  timelineCoverageCount: number;
  missingTimelineCount: number;
  missingEssayCount: number;
  dueSoonCount: number;
  overdueCount: number;
  recommendationsCount: number;
  nextAction: WorkspaceAction;
  readiness: ReadinessSignal[];
  schoolApplications: SchoolApplicationRow[];
  healthChecks: HealthCheck[];
  strategySummary: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysUntil(date?: string, now = new Date()): number | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((startOfDay(parsed).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export function calculateProfileScore(profile?: Profile | null): number {
  if (!profile) return 0;
  return (
    (profile.gpa ? 20 : 0) +
    (profile.testScores?.length ? 30 : 0) +
    (profile.activities?.length ? 25 : 0) +
    (profile.awards?.length ? 25 : 0)
  );
}

function chooseTimeline(
  school: SchoolListItem,
  timelinesBySchool: Map<string, TimelineResponse[]>,
  now: Date
) {
  const timelines = timelinesBySchool.get(school.schoolId) ?? [];
  if (timelines.length === 0) return undefined;
  const desiredRound = school.round?.toUpperCase();
  const matchingRound = desiredRound
    ? timelines.find((timeline) => timeline.round?.toUpperCase() === desiredRound)
    : undefined;
  if (matchingRound) return matchingRound;
  return [...timelines].sort((a, b) => {
    const aDays = daysUntil(a.deadline, now);
    const bDays = daysUntil(b.deadline, now);
    if (aDays === null && bDays === null) return 0;
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  })[0];
}

function chooseDeadline(school: SchoolListItem, now: Date) {
  const deadlines = school.deadlines ?? [];
  if (deadlines.length === 0) return undefined;
  const desiredRound = school.round?.toUpperCase();
  const matchingRound = desiredRound
    ? deadlines.find((deadline) => deadline.round?.toUpperCase() === desiredRound)
    : undefined;
  if (matchingRound) return matchingRound;
  return [...deadlines].sort((a, b) => {
    const aDays = daysUntil(a.applicationDeadline, now);
    const bDays = daysUntil(b.applicationDeadline, now);
    if (aDays === null && bDays === null) return 0;
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  })[0];
}

function getUrgency(
  hasTimeline: boolean,
  dayCount: number | null,
  essayPromptCount: number
): ApplicationUrgency {
  if (dayCount !== null && dayCount < 0) return 'overdue';
  if (dayCount !== null && dayCount <= 7) return 'due7';
  if (dayCount !== null && dayCount <= 30) return 'due30';
  if (!hasTimeline) return 'missingTimeline';
  if (essayPromptCount === 0) return 'missingEssay';
  return 'ready';
}

function getNextStep(
  row: Pick<SchoolApplicationRow, 'urgency' | 'essayPromptCount' | 'predictionProbability'>
) {
  if (row.urgency === 'missingTimeline') return 'sync-requirements';
  if (row.urgency === 'overdue' || row.urgency === 'due7') return 'review-deadlines';
  if (row.essayPromptCount > 0) return 'write-essays';
  if (row.predictionProbability === null) return 'run-prediction';
  return 'view-timeline';
}

function rankUrgency(urgency: ApplicationUrgency) {
  switch (urgency) {
    case 'overdue':
      return 0;
    case 'due7':
      return 1;
    case 'due30':
      return 2;
    case 'missingTimeline':
      return 3;
    case 'missingEssay':
      return 4;
    case 'ready':
      return 5;
  }
}

function countRecommendations(recommendations: TieredRecommendations | null) {
  if (!recommendations) return 0;
  return (
    recommendations.reach.length + recommendations.target.length + recommendations.safety.length
  );
}

function getNextAction(args: {
  profileScore: number;
  schoolCount: number;
  tierCounts: ApplicationWorkspaceModel['tierCounts'];
  missingTimelineCount: number;
  missingEssayCount: number;
  overdueCount: number;
  dueSoonCount: number;
}): WorkspaceAction {
  if (args.profileScore < 50)
    return { id: 'complete-profile', href: '/profile', intent: 'navigate' };
  if (args.schoolCount === 0 || args.schoolCount < 6) {
    return { id: 'add-schools', href: '/schools', intent: 'navigate' };
  }
  if (args.tierCounts.safety === 0)
    return { id: 'add-safety', href: '/schools', intent: 'navigate' };
  if (args.missingTimelineCount > 0 || args.missingEssayCount > 0) {
    return { id: 'sync-requirements', intent: 'sync' };
  }
  if (args.overdueCount > 0 || args.dueSoonCount > 0) {
    return { id: 'review-deadlines', href: '/timeline', intent: 'navigate' };
  }
  return { id: 'generate-advice', intent: 'analysis' };
}

export function buildApplicationWorkspaceModel({
  profile,
  schoolList,
  timelines,
  analysis,
  recommendations,
  now = new Date(),
}: {
  profile?: Profile | null;
  schoolList?: SchoolListItem[] | null;
  timelines?: TimelineResponse[] | null;
  analysis?: AIAnalysis | null;
  recommendations?: TieredRecommendations | null;
  now?: Date;
}): ApplicationWorkspaceModel {
  const schools = schoolList ?? [];
  const allTimelines = timelines ?? [];
  const profileScore = calculateProfileScore(profile);
  const tierCounts = {
    reach: schools.filter((school) => school.tier === 'REACH').length,
    target: schools.filter((school) => school.tier === 'TARGET').length,
    safety: schools.filter((school) => school.tier === 'SAFETY').length,
  };
  const essayPromptCount = schools.reduce((sum, school) => sum + (school.essayPromptCount ?? 0), 0);
  const timelinesBySchool = new Map<string, TimelineResponse[]>();
  for (const timeline of allTimelines) {
    const list = timelinesBySchool.get(timeline.schoolId) ?? [];
    list.push(timeline);
    timelinesBySchool.set(timeline.schoolId, list);
  }

  const schoolApplications = schools
    .map<SchoolApplicationRow>((school) => {
      const timeline = chooseTimeline(school, timelinesBySchool, now);
      const deadline = chooseDeadline(school, now);
      const effectiveDeadline = timeline?.deadline ?? deadline?.applicationDeadline;
      const dayCount = daysUntil(effectiveDeadline, now);
      const essayCount = school.essayPromptCount ?? 0;
      const probability =
        typeof school.prediction?.probability === 'number' ? school.prediction.probability : null;
      const urgency = getUrgency(Boolean(timeline), dayCount, essayCount);
      const row: SchoolApplicationRow = {
        id: school.id,
        schoolId: school.schoolId,
        schoolName: school.school.nameZh ?? school.school.name,
        tier: school.tier,
        round: timeline?.round ?? school.round ?? deadline?.round ?? 'RD',
        deadline: effectiveDeadline,
        daysUntil: dayCount,
        essayPromptCount: essayCount,
        hasTimeline: Boolean(timeline),
        tasksTotal: timeline?.tasksTotal ?? 0,
        tasksRemaining: timeline ? Math.max(timeline.tasksTotal - timeline.tasksCompleted, 0) : 0,
        predictionProbability: probability,
        urgency,
        nextStep: 'view-timeline',
      };
      return { ...row, nextStep: getNextStep(row) };
    })
    .sort((a, b) => {
      const urgencyDiff = rankUrgency(a.urgency) - rankUrgency(b.urgency);
      if (urgencyDiff !== 0) return urgencyDiff;
      if (a.daysUntil !== null && b.daysUntil !== null && a.daysUntil !== b.daysUntil) {
        return a.daysUntil - b.daysUntil;
      }
      return a.schoolName.localeCompare(b.schoolName);
    });

  const missingTimelineCount = schoolApplications.filter((row) => !row.hasTimeline).length;
  const missingEssayCount = schoolApplications.filter((row) => row.essayPromptCount === 0).length;
  const dueSoonCount = schoolApplications.filter(
    (row) => row.daysUntil !== null && row.daysUntil >= 0 && row.daysUntil <= 7
  ).length;
  const overdueCount = schoolApplications.filter(
    (row) => row.daysUntil !== null && row.daysUntil < 0
  ).length;
  const nextAction = getNextAction({
    profileScore,
    schoolCount: schools.length,
    tierCounts,
    missingTimelineCount,
    missingEssayCount,
    overdueCount,
    dueSoonCount,
  });
  const recommendationsCount = countRecommendations(recommendations ?? null);

  return {
    profileScore,
    schoolCount: schools.length,
    tierCounts,
    essayPromptCount,
    timelineCoverageCount: schoolApplications.length - missingTimelineCount,
    missingTimelineCount,
    missingEssayCount,
    dueSoonCount,
    overdueCount,
    recommendationsCount,
    nextAction,
    readiness: [
      {
        id: 'profile',
        value: `${profileScore}%`,
        status: profileScore >= 80 ? 'good' : profileScore >= 50 ? 'warning' : 'risk',
      },
      {
        id: 'schools',
        value: schools.length ? String(schools.length) : '0',
        status:
          schools.length >= 6 && tierCounts.safety > 0
            ? 'good'
            : schools.length > 0
              ? 'warning'
              : 'risk',
      },
      {
        id: 'essays',
        value: essayPromptCount ? String(essayPromptCount) : '0',
        status: essayPromptCount > 0 ? (missingEssayCount > 0 ? 'warning' : 'good') : 'warning',
      },
      {
        id: 'deadlines',
        value:
          overdueCount > 0 ? String(overdueCount) : dueSoonCount > 0 ? String(dueSoonCount) : '0',
        status:
          overdueCount > 0
            ? 'risk'
            : dueSoonCount > 0 || missingTimelineCount > 0
              ? 'warning'
              : 'good',
      },
    ],
    schoolApplications,
    healthChecks: [
      {
        id: 'profile',
        status: profileScore >= 80 ? 'good' : profileScore >= 50 ? 'warning' : 'risk',
        action: { id: 'complete-profile', href: '/profile', intent: 'navigate' },
        meta: { profileScore },
      },
      {
        id: 'balance',
        status:
          schools.length >= 6 && tierCounts.safety > 0 && tierCounts.target > 0
            ? 'good'
            : tierCounts.safety === 0 && schools.length > 0
              ? 'risk'
              : 'warning',
        action: {
          id: tierCounts.safety === 0 ? 'add-safety' : 'add-schools',
          href: '/schools',
          intent: 'navigate',
        },
        meta: { schoolCount: schools.length, ...tierCounts },
      },
      {
        id: 'essays',
        status: essayPromptCount > 0 ? (missingEssayCount > 0 ? 'warning' : 'good') : 'warning',
        action: { id: 'sync-requirements', intent: 'sync' },
        meta: { essayPromptCount, missingEssayCount },
      },
      {
        id: 'deadlines',
        status:
          overdueCount > 0
            ? 'risk'
            : dueSoonCount > 0 || missingTimelineCount > 0
              ? 'warning'
              : 'good',
        action: {
          id: overdueCount > 0 || dueSoonCount > 0 ? 'review-deadlines' : 'sync-requirements',
          href: '/timeline',
          intent: overdueCount > 0 || dueSoonCount > 0 ? 'navigate' : 'sync',
        },
        meta: { overdueCount, dueSoonCount, missingTimelineCount },
      },
    ],
    strategySummary:
      analysis?.overallVerdict ??
      analysis?.portfolioSummary?.verdict ??
      (recommendationsCount > 0 ? 'recommendations-ready' : null),
  };
}
