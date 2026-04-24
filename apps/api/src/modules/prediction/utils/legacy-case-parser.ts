/**
 * Parsers for legacy AdmissionCase range-string fields.
 *
 * Historical cases imported from Reddit / A2C / OnePoint3Acres carry
 * data as range strings (`"3.7-3.9"`, `"1500-1550"`, `"32-34"`) rather
 * than structured columns. The training pipeline, Scorecard teacher,
 * and any future per-grade GPA signal need precise numeric values.
 *
 * These pure helpers convert ranges → midpoints, emit a `confidence`
 * hint so downstream consumers can weight exact single-values higher
 * than range-midpoints, and refuse to invent data for gibberish input
 * (e.g. `"strong"`). Null-in → null-out, never throw.
 *
 * Wired up by PredictionWorkflowService.normalizeLegacyCases and by
 * scripts/normalize-legacy-cases.ts.
 */

// ---------------------------------------------------------------------------
// GPA
// ---------------------------------------------------------------------------

export interface ParsedGpa {
  gpa: number; // on the detected scale (e.g. 3.8 on 4.0, 92.5 on 100)
  scale: number; // 4.0 (default), 5.0 (weighted), or 100
  confidence: 'exact' | 'range-midpoint' | 'lower-bound-only';
}

/**
 * Parse a legacy `gpaRange` / `gpaString` into a numeric GPA + scale.
 *
 * Examples:
 *   "3.7-3.9"    → { gpa: 3.8,   scale: 4.0,  confidence: 'range-midpoint' }
 *   "3.8"        → { gpa: 3.8,   scale: 4.0,  confidence: 'exact' }
 *   "3.9+"       → { gpa: 3.9,   scale: 4.0,  confidence: 'lower-bound-only' }
 *   "90-95"      → { gpa: 92.5,  scale: 100,  confidence: 'range-midpoint' }
 *   "4.5"        → { gpa: 4.5,   scale: 5.0,  confidence: 'exact' }
 *   "strong"     → null
 *   "3.7 / 4.0"  → { gpa: 3.7,   scale: 4.0,  confidence: 'exact' }
 *   null | ""    → null
 */
export function parseGpaRange(
  input: string | null | undefined,
): ParsedGpa | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // Accept a "value / scale" annotation up front: "3.7 / 4.0".
  const slashMatch = s.match(
    /^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/,
  );
  if (slashMatch) {
    const gpa = Number(slashMatch[1]);
    const scale = Number(slashMatch[2]);
    if (isValidGpa(gpa, scale)) {
      return { gpa, scale, confidence: 'exact' };
    }
    return null;
  }

  // "3.9+" — lower bound, take the number as the best estimate.
  const plusMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*\+$/);
  if (plusMatch) {
    const gpa = Number(plusMatch[1]);
    const scale = detectGpaScale(gpa);
    if (scale != null) {
      return { gpa, scale, confidence: 'lower-bound-only' };
    }
    return null;
  }

  // "3.7-3.9" or "3.7 to 3.9" — range, take midpoint.
  const rangeMatch = s.match(
    /^([0-9]+(?:\.[0-9]+)?)\s*(?:-|to|～|~|–)\s*([0-9]+(?:\.[0-9]+)?)$/i,
  );
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (high < low) return null; // malformed
    const mid = (low + high) / 2;
    const scale = detectGpaScale(high);
    if (scale != null && isValidGpa(mid, scale)) {
      return { gpa: mid, scale, confidence: 'range-midpoint' };
    }
    return null;
  }

  // Bare number: "3.8".
  const numMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (numMatch) {
    const gpa = Number(numMatch[1]);
    const scale = detectGpaScale(gpa);
    if (scale != null) {
      return { gpa, scale, confidence: 'exact' };
    }
  }

  return null;
}

/**
 * Heuristic: GPA scale based on value magnitude. Order matters —
 * 100-point is checked first so "90" doesn't get mis-scaled to 4.5.
 */
function detectGpaScale(value: number): number | null {
  if (value >= 60 && value <= 100) return 100;
  if (value > 4.0 && value <= 5.0) return 5.0; // weighted
  if (value >= 0 && value <= 4.0) return 4.0;
  return null; // out of any recognized range — refuse to guess
}

function isValidGpa(gpa: number, scale: number): boolean {
  if (!Number.isFinite(gpa)) return false;
  if (gpa < 0) return false;
  if (gpa > scale) return false;
  return true;
}

// ---------------------------------------------------------------------------
// SAT / ACT / TOEFL
// ---------------------------------------------------------------------------

export type TestType = 'SAT' | 'ACT' | 'TOEFL' | 'IELTS';

export interface ParsedTestScore {
  type: TestType;
  score: number;
  confidence: 'exact' | 'range-midpoint' | 'lower-bound-only';
}

const TEST_RANGES: Record<TestType, { min: number; max: number }> = {
  SAT: { min: 400, max: 1600 },
  ACT: { min: 1, max: 36 },
  TOEFL: { min: 0, max: 120 },
  IELTS: { min: 0, max: 9 },
};

/**
 * Shared parser for numeric test range strings. Accepts "1500-1550",
 * "1550+", bare "1500". Validates the resulting number is inside the
 * test's official range; rejects out-of-band values rather than
 * clamping them.
 */
export function parseTestScoreRange(
  input: string | null | undefined,
  type: TestType,
): ParsedTestScore | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  const range = TEST_RANGES[type];
  const isValid = (n: number) =>
    Number.isFinite(n) && n >= range.min && n <= range.max;

  // "1550+" — lower bound only.
  const plusMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*\+$/);
  if (plusMatch) {
    const n = Number(plusMatch[1]);
    if (isValid(n))
      return { type, score: round(n, type), confidence: 'lower-bound-only' };
    return null;
  }

  // "1500-1550".
  const rangeMatch = s.match(
    /^([0-9]+(?:\.[0-9]+)?)\s*(?:-|to|～|~|–)\s*([0-9]+(?:\.[0-9]+)?)$/i,
  );
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (high < low) return null;
    const mid = (low + high) / 2;
    if (isValid(mid)) {
      return { type, score: round(mid, type), confidence: 'range-midpoint' };
    }
    return null;
  }

  // Bare number.
  const numMatch = s.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (isValid(n)) return { type, score: round(n, type), confidence: 'exact' };
  }

  return null;
}

/**
 * SAT/ACT/TOEFL are integers; IELTS is half-steps. Round midpoints
 * accordingly so we never emit e.g. `score: 1525.5` for SAT.
 */
function round(n: number, type: TestType): number {
  if (type === 'IELTS') return Math.round(n * 2) / 2;
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// TestScore envelope builder
// ---------------------------------------------------------------------------

/**
 * Persisted `CaseTestScore[]` JSON entry. Matches the shape enforced by
 * `CaseTestScoreDto` in the case module so round-tripped data validates.
 * We tag with `source: 'legacy_range_parse'` so audits can distinguish
 * normalized-from-legacy entries from counselor-entered exact scores.
 */
export interface NormalizedTestScoreEntry {
  type: TestType;
  score: number;
  confidence: 'exact' | 'range-midpoint' | 'lower-bound-only';
  source: 'legacy_range_parse';
}

export function toTestScoreEntry(
  parsed: ParsedTestScore,
): NormalizedTestScoreEntry {
  return {
    type: parsed.type,
    score: parsed.score,
    confidence: parsed.confidence,
    source: 'legacy_range_parse',
  };
}
