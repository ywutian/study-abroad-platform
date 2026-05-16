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
  // 2026-05 Phase 2.5f: refined 6-letter scale (+ '—' neutral).
  // Lower tiers were softened from destructive (red) to warning (amber)
  // because profile completeness is a coaching signal, not a fail-state.
  it('maps profile completeness to the refined enterprise grade scale', () => {
    // Neutral zero — unevaluated, not graded
    expect(getProfileGrade(0).grade).toBe('—');
    expect(getProfileGrade(0).color).toBe('text-muted-foreground');
    // Bottom of the scale (1-19): warning, encouraging — NOT destructive
    expect(getProfileGrade(5).grade).toBe('D');
    expect(getProfileGrade(19).grade).toBe('D');
    expect(getProfileGrade(5).color).toBe('text-warning');
    // New intermediate tier (20-39): warning C-
    expect(getProfileGrade(20).grade).toBe('C-');
    expect(getProfileGrade(39).grade).toBe('C-');
    expect(getProfileGrade(20).color).toBe('text-warning');
    // 40-59: upgraded from warning to primary (no longer reads as risk)
    expect(getProfileGrade(40).grade).toBe('C');
    expect(getProfileGrade(40).color).toBe('text-primary');
    // 60-74: B primary (unchanged)
    expect(getProfileGrade(60).grade).toBe('B');
    expect(getProfileGrade(74).grade).toBe('B');
    // 75-89: B+ primary (unchanged)
    expect(getProfileGrade(75).grade).toBe('B+');
    expect(getProfileGrade(89).grade).toBe('B+');
    // 90+: A success (unchanged)
    expect(getProfileGrade(90).grade).toBe('A');
    expect(getProfileGrade(100).grade).toBe('A');
    // Destructive is no longer used anywhere on the grade scale.
    for (const pct of [0, 5, 19, 20, 39, 40, 60, 75, 90, 100]) {
      expect(getProfileGrade(pct).color).not.toBe('text-destructive');
      expect(getProfileGrade(pct).bgColor).not.toBe('bg-destructive/10');
    }
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
