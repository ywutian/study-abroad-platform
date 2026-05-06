/**
 * Niche Grade Utility
 *
 * Convert Niche letter grades (A+ through F) to a normalized [0, 1] score
 * suitable for weighted ranking and soft-signal aggregation.
 *
 * Niche publishes four primary grades per US college:
 *   - nicheOverallGrade  — overall composite
 *   - nicheSafetyGrade   — campus safety / crime
 *   - nicheLifeGrade     — student life / happiness
 *   - nicheFoodGrade     — campus dining
 *
 * These are *qualitative fit signals* (lifestyle / wellbeing), NOT predictors
 * of admission probability. They belong in:
 *   - Custom ranking (user-weighted)
 *   - School recommendation tie-breakers
 *   - Frontend display
 *
 * They MUST NOT be added to the prediction probability calculation — Niche
 * grades have no causal relationship with admission outcomes.
 */

const GRADE_VALUES: Record<string, number> = {
  'A+': 1.0,
  A: 0.93,
  'A-': 0.87,
  'B+': 0.8,
  B: 0.73,
  'B-': 0.67,
  'C+': 0.6,
  C: 0.53,
  'C-': 0.47,
  'D+': 0.4,
  D: 0.33,
  'D-': 0.27,
  F: 0.13,
};

/**
 * Convert a Niche letter grade to a normalized [0, 1] score.
 * Returns null when the grade is missing or unrecognized so callers can
 * differentiate between "no data" and "low score".
 *
 * @example
 *   nicheGradeToScore('A+')  // 1.0
 *   nicheGradeToScore('B-')  // 0.67
 *   nicheGradeToScore(null)  // null
 *   nicheGradeToScore('?')   // null
 */
export function nicheGradeToScore(
  grade: string | null | undefined,
): number | null {
  if (!grade) return null;
  const normalized = grade.trim().toUpperCase();
  return GRADE_VALUES[normalized] ?? null;
}

/**
 * Whether a value is a recognized Niche grade.
 */
export function isValidNicheGrade(grade: unknown): grade is string {
  return (
    typeof grade === 'string' && grade.trim().toUpperCase() in GRADE_VALUES
  );
}

/**
 * Ordered list of Niche grades from best to worst.
 * Useful for UI dropdowns and validation.
 */
export const NICHE_GRADES = [
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D+',
  'D',
  'D-',
  'F',
] as const;

export type NicheGrade = (typeof NICHE_GRADES)[number];
