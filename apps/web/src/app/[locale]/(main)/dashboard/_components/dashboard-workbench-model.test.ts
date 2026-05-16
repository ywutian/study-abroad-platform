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
  prediction: 'Prediction',
  profileDesc: 'Complete profile',
  schoolsDesc: 'Balance schools',
  essaysDesc: 'Start essays',
  timelineDesc: 'Clear timeline tasks',
  predictionItemDescReady: 'Prediction ready',
  predictionItemDescPending: 'Run your first prediction',
  predictionItemDescBlocked: 'Profile and schools required',
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

    // 2026-05: Prediction added as 5th readiness item (was 4).
    expect(items).toHaveLength(5);
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
      stats: { followers: 0, following: 0, cases: 0, predictions: 0 },
      pendingTasks: { total: 0, byType: [], profileGaps: [] },
    });

    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);
    // Only timeline (no pending) contributes 10. New 5-item layout with
    // weights 40 + 20 + 15 + 10 + 15 = 100; everything but timeline is 0.
    expect(workbench.readiness.score).toBe(10);
    expect(workbench.readiness.items[0].contributionScore).toBe(0); // profile
    expect(workbench.readiness.items[1].contributionScore).toBe(0); // schools
    expect(workbench.readiness.items[2].contributionScore).toBe(0); // essays
    expect(workbench.readiness.items[3].contributionScore).toBe(10); // timeline
    expect(workbench.readiness.items[4].contributionScore).toBe(0); // prediction
  });

  // 2026-05: Prediction is the 5th readiness item. It has three states:
  // - blocked: profile<40% OR no schools (precondition not met)
  // - attention: ready to run but user hasn't yet
  // - ready: at least one prediction generated
  it('marks prediction as blocked when preconditions are missing', () => {
    const dashboard = makeDashboard({
      profile: {
        completeness: 25, // below the 40% precondition
        hasTestScores: false,
        hasActivities: false,
        hasAwards: false,
        targetSchoolCount: 0,
        essayCount: 0,
        schoolTiers: { reach: 0, target: 0, safety: 0 },
      },
      stats: { followers: 0, following: 0, cases: 0, predictions: 0 },
    });

    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);
    const prediction = workbench.readiness.items[4];
    expect(prediction.key).toBe('prediction');
    expect(prediction.status).toBe('blocked');
    expect(prediction.contributionScore).toBe(0);
  });

  it('marks prediction as ready once any prediction has been generated', () => {
    const dashboard = makeDashboard({
      stats: { followers: 0, following: 0, cases: 0, predictions: 3 },
    });
    const workbench = createFallbackWorkbench(dashboard, fallbackCopy);
    const prediction = workbench.readiness.items[4];
    expect(prediction.key).toBe('prediction');
    expect(prediction.status).toBe('ready');
    expect(prediction.contributionScore).toBe(15);
  });
});
