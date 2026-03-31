/**
 * English Proficiency Utility
 *
 * Unified handling for TOEFL, IELTS, and Duolingo English Test (DET).
 * Provides normalization (0-1 scale) so the scoring engine can treat
 * all three tests interchangeably.
 */

const ENGLISH_TESTS = ['TOEFL', 'IELTS', 'DUOLINGO'] as const;

/** Maximum possible score for each English proficiency test */
const MAX_SCORES: Record<string, number> = {
  TOEFL: 120,
  IELTS: 9.0,
  DUOLINGO: 160,
};

/**
 * Normalize an English proficiency score to a 0-1 scale.
 * Returns 0 if the test type is unrecognized.
 */
export function normalizeEnglishScore(type: string, score: number): number {
  const max = MAX_SCORES[type];
  return max ? score / max : 0;
}

/**
 * From a list of test scores, find the best English proficiency result
 * (highest normalized score across TOEFL, IELTS, and Duolingo).
 *
 * Returns undefined if no English proficiency test is present.
 */
export function getBestEnglishProficiency(
  testScores: Array<{ type: string; score: number }>
): { score: number; type: string; normalized: number } | undefined {
  let best: { score: number; type: string; normalized: number } | undefined;
  for (const ts of testScores) {
    if (!ENGLISH_TESTS.includes(ts.type as (typeof ENGLISH_TESTS)[number])) continue;
    const norm = normalizeEnglishScore(ts.type, ts.score);
    if (!best || norm > best.normalized) {
      best = { score: ts.score, type: ts.type, normalized: norm };
    }
  }
  return best;
}

/**
 * Check whether a test type is an English proficiency test.
 */
export function isEnglishProficiencyTest(type: string): boolean {
  return ENGLISH_TESTS.includes(type as (typeof ENGLISH_TESTS)[number]);
}

/**
 * Thresholds for the unified English proficiency scoring in the academic score engine.
 *
 * All values are on the normalized 0-1 scale:
 * - baseline ~0.875 corresponds to TOEFL 105, IELTS 7.875, Duolingo 140
 * - hardPenalty ~0.75 corresponds to TOEFL 90, IELTS 6.75, Duolingo 120
 */
export const ENGLISH_PROFICIENCY_THRESHOLDS = {
  /** Neutral point (normalized). Scores above get bonus, below get penalty. */
  baseline: 0.875,
  /** Below this normalized score, a hard penalty applies. */
  hardPenalty: 0.75,
  /** Maximum bonus/penalty points in the academic score. */
  maxBonus: 10,
  /** Hard penalty deduction applied when score < hardPenalty threshold. */
  hardPenaltyValue: -8,
} as const;
