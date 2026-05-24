/**
 * Counselor Calibration Spec — Layer 3 fixture schema.
 *
 * See docs/PREDICTION_CALIBRATION_METHODOLOGY.md for the methodology.
 *
 * Key principle: expected ranges are NORMATIVE — derived from industry
 * intuition (NACAC / Crimson / CDS / counselor consensus), not from what
 * the current engine math produces. If the engine drifts, the spec fails;
 * if industry research updates, the spec gets refreshed in its own PR
 * with citations.
 */
import type { ProfileInput } from '../../src/modules/prediction/prediction.prompts';

export type ScenarioGroup =
  | 'T5_REA_STRONG_UNHOOKED_DOMESTIC'
  | 'T5_RD_STRONG_UNHOOKED_DOMESTIC'
  | 'T5_RD_STRONG_UNHOOKED_INTL'
  | 'T5_RD_LEGACY_VERIFIED'
  | 'T5_RD_ATHLETE_VERIFIED'
  | 'T20_ED_STRONG_UNHOOKED'
  | 'T20_EA_STRONG_INTL'
  | 'T30_EA_MID_STRONG'
  | 'MATCH_RD_MID_PROFILE'
  | 'SAFETY_RD_STRONG'
  | 'EXTREME_BOUND_WEAK_AT_T5'
  | 'EXTREME_BOUND_PERFECT_AT_SAFETY'
  | 'INTL_PENALTY'
  | 'ED_BOOST'
  | 'TEST_OPTIONAL'
  | 'LOW_GPA_HIGH_TEST'
  | 'HIGH_GPA_LOW_TEST'
  | 'FIRST_GEN_T20';

export interface RationaleSource {
  /** Human-readable label, e.g. "MIT CDS 2024-25", "NACAC State of Admission 2024" */
  name: string;
  /** Optional URL or doc reference */
  url?: string;
  /** Short quote / paraphrase from the source explaining why the expected band fits */
  evidence: string;
}

export interface Rationale {
  /** Plain-language explanation of why the expected band is sensible */
  intuition: string;
  /** ≥ 1 public source must be cited (NACAC / Crimson / CDS / school admissions blog) */
  sources: RationaleSource[];
}

/**
 * Standalone calibration fixture — single (profile, school, round) tuple
 * with an industry-anchored expected probability band.
 *
 * For comparative cases (e.g. ED-vs-RD lift, intl-vs-domestic penalty),
 * use ComparativeFixture below.
 */
export interface CalibrationFixture {
  id: string;
  scenarioGroup: ScenarioGroup;
  schoolName: string;
  applicationRound: string;
  profile: ProfileInput & {
    /** Extended fields counselor reads but ProfileInput omits */
    recruitedAthlete?: boolean;
    urmStatus?: string | null;
  };
  expectedProbabilityRange: [number, number];
  expectedTier?: 'reach' | 'match' | 'safety';
  expectedConfidenceAtMost?: 'very-low' | 'low' | 'medium' | 'high';
  rationale: Rationale;
  /**
   * Mark a fixture as a known engine gap that should NOT block CI.
   * The fixture still runs and reports its actual output, but is exempt
   * from pass/fail counting. Use sparingly — only for documented engine
   * limitations awaiting follow-up work (e.g. unverified athlete hook).
   * Each wontFix should have a tracking link or follow-up PR/issue ref.
   */
  wontFix?: {
    reason: string;
    followUp?: string;
  };
  lastReviewedAt: string;
  reviewedBy: string;
  tags: string[];
}

/**
 * Comparative fixture — two predictions of the SAME profile differing by
 * one dimension (round / nationality / hook). Asserts the DELTA, not the
 * absolute value. Useful for "ED boost should be ≥ 5pp" or "intl penalty
 * should be ≥ 3pp" assertions that don't depend on the absolute anchor.
 */
export interface ComparativeFixture {
  id: string;
  scenarioGroup: ScenarioGroup;
  schoolName: string;
  /** The dimension that toggles between A and B */
  comparedDimension: 'round' | 'international' | 'hook';
  baseProfile: ProfileInput & {
    recruitedAthlete?: boolean;
    urmStatus?: string | null;
  };
  caseA: {
    label: string;
    applicationRound?: string;
    profileOverride?: Partial<ProfileInput>;
  };
  caseB: {
    label: string;
    applicationRound?: string;
    profileOverride?: Partial<ProfileInput>;
  };
  /** caseA probability minus caseB probability must be ≥ minDelta */
  expectedMinDelta: number;
  /** Optional upper bound on the delta (some hooks shouldn't go too crazy) */
  expectedMaxDelta?: number;
  rationale: Rationale;
  /** See CalibrationFixture.wontFix */
  wontFix?: {
    reason: string;
    followUp?: string;
  };
  lastReviewedAt: string;
  reviewedBy: string;
  tags: string[];
}

export type AnyFixture =
  | { kind: 'standalone'; spec: CalibrationFixture }
  | { kind: 'comparative'; spec: ComparativeFixture };

export interface FixtureResult {
  fixtureId: string;
  scenarioGroup: ScenarioGroup;
  passed: boolean;
  details: string;
  failures: string[];
  actual: {
    /** For standalone: the single probability */
    probability?: number;
    tier?: string;
    confidence?: string;
    /** For comparative: both probabilities + delta */
    caseAProbability?: number;
    caseBProbability?: number;
    delta?: number;
  };
}
