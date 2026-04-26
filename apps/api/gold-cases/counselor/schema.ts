/**
 * Counselor Engine Gold Cases — schema for synthetic regression test set.
 *
 * Each case file under `cases/*.json` declares a (profile, school, round)
 * tuple with an expected probability range. The CI runner asserts that
 * the counselor engine returns a probability inside the range; any drift
 * fails the build.
 *
 * Why JSON (not YAML or TS):
 * - Compile-time typed import (TypeScript validates JSON imports against
 *   `CounselorGoldCase` via `import case001 from './001-...json'`)
 * - Same convention as existing `apps/api/gold-cases/cases/` (application-
 *   analysis governance precedent)
 * - Diffable / reviewable in PR — schema changes are visible in JSON
 *
 * Why a separate schema (not reusing `GoldCase`):
 * - Application-analysis governance tests `state` + `schoolCards[]` + tier
 *   + testingPolicy + forbidden keywords (heavy contract).
 * - Counselor tests one number per case: `result.probability ∈ [low, high]`.
 *   A flat schema keeps the cases tiny and the runner's assertion shallow.
 */

import type { ProfileInput } from '../../src/modules/prediction/prediction.prompts';

export interface CounselorGoldCase {
  /** Stable ID (kebab-case). Used in test output + report filenames. */
  id: string;

  /** One-sentence human-readable name. Surfaces in CI failure logs. */
  description: string;

  /** Long-form rationale: WHY this expected range? Source URL if from CDS. */
  rationale: string;

  /** ISO date of last manual review of this case. Update when mods change. */
  lastReviewedAt: string;

  /** Profile input fed to counselor.compute(). Subset of ProfileInput. */
  profile: Partial<
    Pick<
      ProfileInput,
      | 'gpa'
      | 'gpaScale'
      | 'grade'
      | 'targetMajor'
      | 'highSchoolId'
      | 'highSchoolLocation'
      | 'isInternational'
      | 'nationality'
      | 'isLegacy'
      | 'legacySchools'
      | 'isFirstGen'
      | 'testScores'
      | 'activities'
      | 'awards'
    >
  > & {
    recruitedAthlete?: boolean;
    urmStatus?: 'BLACK' | 'HISPANIC' | 'NATIVE_AMERICAN' | 'PACIFIC_ISLANDER';
  };

  /**
   * Look up this school in the DB by exact name match. Don't use cuid school
   * IDs because they vary between dev / staging / CI fresh-seed.
   */
  schoolName: string;

  /** Application round (RD if omitted). */
  applicationRound?: 'RD' | 'EA' | 'ED' | 'ED2' | 'REA' | 'SCEA';

  /**
   * Expected probability range — inclusive bounds, slack of ±0.005 applied
   * by the runner so floating-point comparisons don't flake.
   */
  expectedProbabilityRange: [number, number];

  /**
   * Optional: assert which tier the anchor resolved to (1=cds-bands, 2=
   * scorecard+SAT, 3=scorecard, 4=insufficient). Useful for tracking when
   * CDS data lands and a case upgrades from Tier 2 to Tier 1.
   */
  expectedTier?: 1 | 2 | 3 | 4;

  /** Tags for filtering: which subsystem the case primarily exercises. */
  tags: Array<
    | 'tier-1-cds-bands'
    | 'tier-2-algorithmic'
    | 'tier-4-insufficient'
    | 'uc-system'
    | 't20-private'
    | 'hook-legacy'
    | 'hook-first-gen'
    | 'hook-athlete'
    | 'hook-urm'
    | 'international'
    | 'edge-case'
  >;
}

export interface CounselorGoldReplayResult {
  caseId: string;
  passed: boolean;
  probability: number;
  expectedRange: [number, number];
  tier: number;
  anchor: number;
  anchorSource: string;
  failureReason?: string;
}
