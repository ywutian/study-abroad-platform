'use client';

export type DashboardSeverity = 'critical' | 'warning' | 'normal' | 'success';
export type DashboardReadinessStatus = 'blocked' | 'attention' | 'ready';

export interface DashboardWorkbench {
  readiness: {
    score: number;
    status: DashboardReadinessStatus;
    items: {
      key: 'profile' | 'schools' | 'essays' | 'timeline';
      label: string;
      value: string;
      status: DashboardReadinessStatus;
      href: string;
      description: string;
    }[];
  };
  metrics: {
    due7: number;
    due30: number;
    overdueTasks: number;
    missingTimelineCount: number;
    balancedSchoolList: boolean;
  };
  priorityQueue: DashboardPriorityItem[];
  deadlineStream: DashboardDeadlineItem[];
}

export interface DashboardPriorityItem {
  id: string;
  kind:
    | 'profile'
    | 'school-list'
    | 'timeline'
    | 'timeline-task'
    | 'essay'
    | 'prediction'
    | 'deadline';
  severity: DashboardSeverity;
  title: string;
  description: string;
  href: string;
  dueAt?: string | null;
  daysLeft?: number | null;
  mutation?: {
    type: 'timeline-task-toggle';
    endpoint: string;
  };
}

export interface DashboardDeadlineItem {
  id: string;
  type: 'school' | 'event' | 'task';
  title: string;
  subtitle: string;
  dueAt: string;
  daysLeft: number;
  severity: DashboardSeverity;
  href: string;
}

export interface DashboardData {
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
    hasEducation?: boolean;
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
  workbench?: DashboardWorkbench;
}

export interface TodoItem {
  id: string;
  type: 'school' | 'event';
  title: string;
  subtitle: string;
  date: Date;
  dateStr: string;
  daysLeft: number;
}

export function getProfileGrade(completeness: number): {
  grade: string;
  color: string;
  bgColor: string;
} {
  if (completeness >= 90) {
    return { grade: 'A', color: 'text-success', bgColor: 'bg-success/10' };
  }
  if (completeness >= 75) return { grade: 'B+', color: 'text-primary', bgColor: 'bg-primary/10' };
  if (completeness >= 60) return { grade: 'B', color: 'text-primary', bgColor: 'bg-primary/10' };
  if (completeness >= 40) return { grade: 'C', color: 'text-warning', bgColor: 'bg-warning/10' };
  return { grade: 'D', color: 'text-destructive', bgColor: 'bg-destructive/10' };
}

export function buildTodoList(dashboard: DashboardData | undefined, locale: string): TodoItem[] {
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
}

export function createFallbackWorkbench(
  dashboard: DashboardData | undefined,
  copy: {
    profile: string;
    schools: string;
    essays: string;
    timeline: string;
    profileDesc: string;
    schoolsDesc: string;
    essaysDesc: string;
    timelineDesc: string;
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
  const score = Math.min(
    100,
    Math.round(
      completeness * 0.45 +
        Math.min(schoolCount / 6, 1) * 25 +
        (essayCount > 0 ? 15 : 0) +
        (pending === 0 ? 15 : Math.max(0, 12 - Math.min(pending, 12)))
    )
  );
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
          value: `${completeness}%`,
          status: completeness >= 75 ? 'ready' : completeness >= 40 ? 'attention' : 'blocked',
          href: '/profile',
          description: copy.profileDesc,
        },
        {
          key: 'schools',
          label: copy.schools,
          value: String(schoolCount),
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
          value: String(essayCount),
          status: essayCount > 0 ? 'ready' : 'attention',
          href: '/essays',
          description: copy.essaysDesc,
        },
        {
          key: 'timeline',
          label: copy.timeline,
          value: String(pending),
          status: pending === 0 ? 'ready' : 'attention',
          href: '/timeline',
          description: copy.timelineDesc,
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
