import { describe, expect, it } from 'vitest';

import {
  buildTodoList,
  createFallbackWorkbench,
  getProfileGrade,
  type DashboardData,
} from './dashboard-workbench-model';

const fallbackCopy = {
  profile: 'Profile',
  schools: 'Schools',
  essays: 'Essays',
  timeline: 'Timeline',
  profileDesc: 'Complete profile',
  schoolsDesc: 'Balance schools',
  essaysDesc: 'Start essays',
  timelineDesc: 'Clear timeline tasks',
  profileAction: 'Complete profile',
  schoolAction: 'Build school list',
  essayAction: 'Start essays',
  timelineAction: 'Clear tasks',
  predictionAction: 'Review prediction',
  predictionDesc: 'Review route',
};

function makeDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    user: {
      email: 'amy@example.com',
      role: 'USER',
      points: 120,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    profile: {
      completeness: 82,
      hasTestScores: true,
      hasActivities: true,
      hasAwards: false,
      targetSchoolCount: 6,
      essayCount: 2,
      schoolTiers: { reach: 2, target: 3, safety: 1 },
    },
    stats: { followers: 0, following: 0, cases: 0, predictions: 1 },
    pendingTasks: { total: 2, byType: [], profileGaps: [] },
    upcomingDeadlines: [],
    upcomingPersonalEvents: [],
    recentActivity: [],
    ...overrides,
  };
}

describe('dashboard workbench model', () => {
  it('maps profile completeness to the enterprise grade scale', () => {
    expect(getProfileGrade(91).grade).toBe('A');
    expect(getProfileGrade(76).grade).toBe('B+');
    expect(getProfileGrade(20).grade).toBe('D');
  });

  it('sorts school and personal deadlines into one todo list', () => {
    const dashboard = makeDashboard({
      upcomingDeadlines: [
        {
          id: 'school-2',
          schoolName: 'Stanford',
          round: 'RD',
          deadline: '2026-01-15T00:00:00.000Z',
          daysLeft: 20,
        },
      ],
      upcomingPersonalEvents: [
        {
          id: 'event-1',
          title: 'SAT',
          category: 'TEST',
          deadline: '2026-01-05T00:00:00.000Z',
          eventDate: null,
          daysLeft: 10,
        },
      ],
    });

    expect(buildTodoList(dashboard, 'en').map((item) => item.id)).toEqual(['event-1', 'school-2']);
  });

  it('prioritizes profile work when fallback data has low readiness', () => {
    const dashboard = makeDashboard({
      profile: {
        completeness: 35,
        hasTestScores: false,
        hasActivities: false,
        hasAwards: false,
        targetSchoolCount: 0,
        essayCount: 0,
        schoolTiers: { reach: 0, target: 0, safety: 0 },
      },
      pendingTasks: { total: 0, byType: [], profileGaps: ['gpa', 'activities'] },
    });

    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);

    expect(workbench.readiness.status).toBe('blocked');
    expect(workbench.priorityQueue[0]).toMatchObject({
      kind: 'profile',
      severity: 'critical',
    });
  });

  it('marks a complete balanced dashboard as ready in fallback mode', () => {
    const dashboard = makeDashboard({ pendingTasks: { total: 0, byType: [], profileGaps: [] } });
    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);

    expect(workbench.readiness.status).toBe('ready');
    expect(workbench.metrics.balancedSchoolList).toBe(true);
  });
});
