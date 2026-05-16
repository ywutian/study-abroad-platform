import { describe, expect, it } from 'vitest';

import {
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

  // 2026-05: readiness total must equal the sum of its items' contribution
  // scores, so users can audit "20% readiness" against the four sub-scores
  // without hitting the old "Readiness 20% / Profile 0%" contradiction.
  it('readiness total equals the sum of per-item contribution scores', () => {
    const dashboard = makeDashboard({
      profile: {
        completeness: 50,
        hasTestScores: true,
        hasActivities: false,
        hasAwards: false,
        targetSchoolCount: 3,
        essayCount: 1,
        schoolTiers: { reach: 1, target: 2, safety: 0 },
      },
      pendingTasks: { total: 2, byType: [], profileGaps: [] },
    });

    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);
    const items = workbench.readiness.items;

    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.contributionScore).toBeDefined();
      expect(item.contributionDenom).toBeDefined();
      expect(item.value).toBe(`${item.contributionScore}/${item.contributionDenom}`);
    }

    const sum = items.reduce((acc, item) => acc + (item.contributionScore ?? 0), 0);
    expect(workbench.readiness.score).toBe(Math.min(100, sum));
  });

  it('emits zero contribution scores for a brand-new empty profile', () => {
    const dashboard = makeDashboard({
      profile: {
        completeness: 0,
        hasTestScores: false,
        hasActivities: false,
        hasAwards: false,
        targetSchoolCount: 0,
        essayCount: 0,
        schoolTiers: { reach: 0, target: 0, safety: 0 },
      },
      pendingTasks: { total: 0, byType: [], profileGaps: [] },
    });

    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);
    expect(workbench.readiness.score).toBe(15); // only timeline (no pending) contributes
    expect(workbench.readiness.items[0].contributionScore).toBe(0);
    expect(workbench.readiness.items[1].contributionScore).toBe(0);
    expect(workbench.readiness.items[2].contributionScore).toBe(0);
    expect(workbench.readiness.items[3].contributionScore).toBe(15);
  });
});
