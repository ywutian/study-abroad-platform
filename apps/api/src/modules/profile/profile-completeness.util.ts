/**
 * Profile completeness algorithm — single source of truth.
 *
 * Used by:
 * - `apps/api/src/modules/user/dashboard.service.ts` (dashboard readiness)
 * - `apps/api/src/modules/prediction/prediction.service.ts` (Phase 1 Bug 2:
 *   precondition check that user has at least 40% completeness before
 *   running a prediction — see docs/architecture/dashboard-invariants.md)
 *
 * 2026-05: Extracted from dashboard.service.ts as part of the Phase 1
 * data-integrity fix. The two callers must NOT diverge — if one starts
 * computing differently, prediction precondition and dashboard readiness
 * become inconsistent again (the same drift class PR #178/#179 fixed
 * for types).
 */

export interface ProfileCompletenessInput {
  /** Whether the user is applying test-optional (no SAT/ACT) */
  applyingTestOptional?: boolean | null;
  /** Stated target major (e.g., "Computer Science") */
  targetMajor?: string | null;
  /** High-school grade level (e.g., "SENIOR", "JUNIOR") */
  grade?: string | null;
  /**
   * GPA — only truthiness is checked, so any non-falsy value counts.
   * Typed as `unknown` to accept Prisma's `Decimal` runtime type without
   * importing the Prisma decimal class into the shared util.
   */
  gpa?: unknown;
  /** Test score records (only count matters) */
  testScores?: Array<unknown> | null;
  /** Activity records */
  activities?: Array<unknown> | null;
  /** Award records */
  awards?: Array<unknown> | null;
}

export interface ProfileCompletenessResult {
  completeness: number;
  profileGaps: string[];
}

export function calculateProfileCompleteness(
  profile: ProfileCompletenessInput | null | undefined,
  schoolListCount: number,
): ProfileCompletenessResult {
  if (!profile) {
    return {
      completeness: 0,
      profileGaps: [
        'basicInfo',
        'gpa',
        'testScores',
        'activities',
        'awards',
        'targetSchools',
      ],
    };
  }

  let score = 0;
  const gaps: string[] = [];

  // Industry priority: GPA + rigor first, tests second.
  // When applyingTestOptional is true, the testScores weight is
  // redistributed to GPA so test-optional applicants are not penalized
  // for missing standardized scores.
  const isTestOptional = profile.applyingTestOptional === true;
  const weights = {
    basicInfo: 20,
    gpa: isTestOptional ? 35 : 25,
    testScores: isTestOptional ? 0 : 15,
    activities: 20,
    awards: 10,
    targetSchools: 10,
  };

  // 基本信息
  if (profile.targetMajor || profile.grade) {
    score += weights.basicInfo;
  } else {
    gaps.push('basicInfo');
  }

  // GPA
  if (profile.gpa) {
    score += weights.gpa;
  } else {
    gaps.push('gpa');
  }

  // 标化成绩 — skipped when test-optional (weight is 0)
  if (!isTestOptional) {
    if ((profile.testScores?.length ?? 0) > 0) {
      score += weights.testScores;
    } else {
      gaps.push('testScores');
    }
  }

  // 活动
  if ((profile.activities?.length ?? 0) > 0) {
    score += weights.activities;
  } else {
    gaps.push('activities');
  }

  // 奖项
  if ((profile.awards?.length ?? 0) > 0) {
    score += weights.awards;
  } else {
    gaps.push('awards');
  }

  // 目标学校（使用 SchoolListItem 数据）
  if (schoolListCount > 0) {
    score += weights.targetSchools;
  } else {
    gaps.push('targetSchools');
  }

  return { completeness: Math.min(100, score), profileGaps: gaps };
}

/**
 * Minimum completeness required to run an admission prediction.
 * Below this threshold, predict() throws 412
 * `PRECONDITION_PROFILE_INSUFFICIENT`.
 *
 * Rationale: with < 40% profile data, the prediction model's signals
 * are too sparse and produce misleadingly confident probabilities.
 */
export const PREDICTION_MIN_COMPLETENESS = 40;
