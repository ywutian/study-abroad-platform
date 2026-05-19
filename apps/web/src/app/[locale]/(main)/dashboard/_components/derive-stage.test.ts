import { describe, expect, it } from 'vitest';
import { deriveStage } from '@study-abroad/shared';
import type { DashboardPipeline } from '@study-abroad/shared';

/**
 * `deriveStage` is the dashboard application-stage selector (lives in
 * @study-abroad/shared). It has no test runner in the shared package, so
 * the regression coverage lives here in the web app's Vitest suite.
 *
 * The load-bearing guarantee under test: `primary` picks the latest phase,
 * but `parallel` always carries every other in-flight track — so a user
 * who received a result is never told the application season is "over"
 * while RD essays are still in progress.
 */

function pipeline(overrides: Partial<DashboardPipeline>): DashboardPipeline {
  return {
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    accepted: 0,
    rejected: 0,
    waitlisted: 0,
    withdrawn: 0,
    recentDecisions: [],
    ...overrides,
  };
}

describe('deriveStage', () => {
  it('onboarding — brand-new account, no schools/essays/pipeline', () => {
    const r = deriveStage({ targetSchoolCount: 0, essayCount: 0, completeness: 0 });
    expect(r.primary).toBe('onboarding');
  });

  it('planning — has target schools but no materials started', () => {
    const r = deriveStage({ targetSchoolCount: 5, essayCount: 0, completeness: 50 });
    expect(r.primary).toBe('planning');
  });

  it('executing — essays started counts as working materials', () => {
    const r = deriveStage({ targetSchoolCount: 5, essayCount: 2, completeness: 60 });
    expect(r.primary).toBe('executing');
  });

  it('executing — fully submitted (none still in progress) is not "submitting"', () => {
    const r = deriveStage({
      targetSchoolCount: 5,
      essayCount: 3,
      completeness: 80,
      pipeline: pipeline({ submitted: 5, inProgress: 0 }),
    });
    expect(r.primary).toBe('executing');
  });

  it('submitting — submitted some, still writing others', () => {
    const r = deriveStage({
      targetSchoolCount: 8,
      essayCount: 4,
      completeness: 85,
      pipeline: pipeline({ submitted: 3, inProgress: 4 }),
    });
    expect(r.primary).toBe('submitting');
  });

  it('decision — any real result (accepted/waitlisted/rejected) wins', () => {
    expect(
      deriveStage({
        targetSchoolCount: 8,
        essayCount: 6,
        completeness: 90,
        pipeline: pipeline({ accepted: 1 }),
      }).primary
    ).toBe('decision');
    expect(
      deriveStage({
        targetSchoolCount: 8,
        essayCount: 6,
        completeness: 90,
        pipeline: pipeline({ waitlisted: 1 }),
      }).primary
    ).toBe('decision');
  });

  it('withdrawn alone is NOT a decision result', () => {
    const r = deriveStage({
      targetSchoolCount: 5,
      essayCount: 2,
      completeness: 70,
      pipeline: pipeline({ withdrawn: 2, submitted: 1, inProgress: 1 }),
    });
    expect(r.primary).toBe('submitting');
  });

  it('parallel is never lost — decision primary still reports in-progress essays', () => {
    const r = deriveStage({
      targetSchoolCount: 9,
      essayCount: 6,
      completeness: 90,
      pipeline: pipeline({ accepted: 1, inProgress: 4, submitted: 3 }),
    });
    expect(r.primary).toBe('decision');
    expect(r.parallel.hasInProgress).toBe(true);
    expect(r.parallel.hasSubmitted).toBe(true);
    expect(r.parallel.hasAccepted).toBe(true);
  });

  it('undefined pipeline is treated as all-zero', () => {
    expect(deriveStage({ targetSchoolCount: 0, essayCount: 0, completeness: 0 }).primary).toBe(
      'onboarding'
    );
    expect(deriveStage({ targetSchoolCount: 3, essayCount: 0, completeness: 30 }).primary).toBe(
      'planning'
    );
  });
});
