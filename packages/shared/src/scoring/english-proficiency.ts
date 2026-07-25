/**
 * English Proficiency Utility
 *
 * Unified handling for TOEFL, IELTS, and Duolingo English Test (DET).
 * Normalizes all three onto one 0-1 scale so the scoring engine can compare
 * them.
 *
 * **The 0-1 scale is legacy-TOEFL-0-120 divided by 120.** That pivot is not
 * arbitrary: `ENGLISH_PROFICIENCY_THRESHOLDS` below were calibrated against
 * TOEFL, so routing the other tests through a TOEFL equivalent keeps those
 * thresholds meaningful instead of silently re-tuning them.
 *
 * The previous implementation was `score / max`, which is wrong across tests:
 * IELTS starts at 1 and DET at 10, so the scales have different floors and a
 * plain ratio isn't comparable. It put the baseline at IELTS 7.875 when the
 * official ETS/IELTS concordance puts TOEFL 105 at IELTS 7.5.
 *
 * Concordance sources (verified 2026-07-24):
 *   - TOEFL 1-6 <-> 0-120: ETS score scale update (effective 2026-01-21)
 *   - IELTS <-> TOEFL: ETS/IELTS joint concordance (2024 study)
 *   - DET <-> IELTS/TOEFL: Duolingo published concordance (2024-2025 data)
 *
 * Anchors are band MIDPOINTS — the published tables map to ranges, and a
 * midpoint is the honest point estimate for "somewhere in this band".
 */

const ENGLISH_TESTS = ['TOEFL', 'IELTS', 'DUOLINGO'] as const;

/** The pivot scale: legacy TOEFL iBT total. */
const LEGACY_TOEFL_MAX = 120;

/**
 * ETS replaced the 0-120 TOEFL scale with 1-6 (half-point increments) on
 * 2026-01-21. Legacy scores stay valid for two years, and reports show both
 * through January 2028 — so BOTH scales are live in applicant data right now
 * and a stored `{ type: 'TOEFL', score: N }` is ambiguous on its face.
 *
 * We disambiguate by magnitude: the new scale tops out at 6, so anything above
 * that is a legacy total. Without this, a new-scale 5.5 (C1, ~110 legacy) was
 * read as 5.5/120 = 0.046 and drew the hard penalty — a strong applicant
 * scored as though they barely spoke English.
 *
 * ponytail: magnitude sniffing, because the score column carries no scale
 * flag. Ceiling: a legacy total of 6 or below is misread as new-scale — those
 * are unusable for admissions anyway, so nobody submits them. Upgrade path:
 * persist the scale alongside the score and branch on it instead.
 */
const TOEFL_NEW_SCALE_MAX = 6;

type Anchor = readonly [input: number, legacyToefl: number];

/** TOEFL 1-6 -> legacy 0-120 (ETS published band midpoints). */
const TOEFL_NEW_TO_LEGACY: readonly Anchor[] = [
  [1, 5], // 0-11    A1
  [1.5, 17], // 12-23   A1
  [2, 28], // 24-33   A2
  [2.5, 38], // 34-43   A2
  [3, 50], // 44-57   B1
  [3.5, 64], // 58-71   B1
  [4, 78], // 72-85   B2
  [4.5, 90], // 86-94   B2
  [5, 100], // 95-106  C1
  [5.5, 110], // 107-113 C1
  [6, 117], // 114+    C2
];

/** IELTS band -> legacy TOEFL (ETS/IELTS 2024 concordance midpoints). */
const IELTS_TO_LEGACY_TOEFL: readonly Anchor[] = [
  [5.0, 40], // 35-45
  [5.5, 52], // 46-59
  [6.0, 69], // 60-78
  [6.5, 86], // 79-93
  [7.0, 97], // 94-101
  [7.5, 105], // 102-109
  [8.0, 111], // 110-112
  [8.5, 115], // 113-117
  [9.0, 119], // 118-120
];

/** DET -> legacy TOEFL (Duolingo published concordance midpoints). */
const DET_TO_LEGACY_TOEFL: readonly Anchor[] = [
  [95, 52], // 90-99    ~ IELTS 5.5
  [105, 69], // 100-109  ~ IELTS 6.0
  [115, 86], // 110-119  ~ IELTS 6.5
  [125, 97], // 120-129  ~ IELTS 7.0
  [137, 105], // 130-144  ~ IELTS 7.5
  [145, 111], // 145-160  ~ IELTS 8.0+
  [160, 119],
];

/**
 * Piecewise-linear lookup over sorted anchors, clamped at both ends.
 * Monotonic by construction, so a higher raw score never scores lower.
 */
function interpolate(anchors: readonly Anchor[], value: number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];

  for (let i = 1; i < anchors.length; i++) {
    const [hiIn, hiOut] = anchors[i];
    if (value <= hiIn) {
      const [loIn, loOut] = anchors[i - 1];
      const span = hiIn - loIn;
      if (span === 0) return hiOut;
      return loOut + ((value - loIn) / span) * (hiOut - loOut);
    }
  }
  return last[1];
}

/**
 * Convert any supported English test score to its legacy TOEFL iBT (0-120)
 * equivalent. Returns null for an unrecognized test type.
 */
export function toLegacyToeflEquivalent(type: string, score: number): number | null {
  if (!Number.isFinite(score)) return null;

  switch (type) {
    case 'TOEFL':
      return score <= TOEFL_NEW_SCALE_MAX
        ? interpolate(TOEFL_NEW_TO_LEGACY, score)
        : Math.min(score, LEGACY_TOEFL_MAX);
    case 'IELTS':
      return interpolate(IELTS_TO_LEGACY_TOEFL, score);
    case 'DUOLINGO':
      return interpolate(DET_TO_LEGACY_TOEFL, score);
    default:
      return null;
  }
}

/**
 * Normalize an English proficiency score to a 0-1 scale via its legacy-TOEFL
 * equivalent. Returns 0 if the test type is unrecognized.
 */
export function normalizeEnglishScore(type: string, score: number): number {
  const legacy = toLegacyToeflEquivalent(type, score);
  return legacy == null ? 0 : legacy / LEGACY_TOEFL_MAX;
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
 * Thresholds for the unified English proficiency scoring in the academic score
 * engine. Values are on the normalized 0-1 scale (= legacy TOEFL / 120).
 *
 * Equivalents under the concordance above — unchanged for TOEFL, which is what
 * these were calibrated against:
 * - baseline   0.875 = TOEFL 105 (new-scale ~5.4) = IELTS 7.5   = DET ~137
 * - hardPenalty 0.75 = TOEFL  90 (new-scale ~4.5) = IELTS ~6.68 = DET ~119
 *
 * The old comment claimed baseline meant IELTS 7.875 / DET 140. IELTS was
 * genuinely too strict by ~0.4 of a band; DET 140 was within the right band and
 * barely moves.
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
