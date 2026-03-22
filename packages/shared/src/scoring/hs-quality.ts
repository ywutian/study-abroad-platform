/**
 * High School Data Quality Scoring
 *
 * Layer 1 of the closed-loop architecture: computes a quality score (0-100)
 * for high school data at ingestion time. All 6 data paths (user suggestion,
 * admin approval, Niche scraper, AI evaluation, batch import, admin edit)
 * must run data through this function before persisting.
 *
 * Quality grades determine routing:
 *   A (≥80): Full evaluation data — participates in scoring at full weight
 *   B (60-79): Partial evaluation — participates but marked "partial"
 *   C (40-59): Identity only + some signals — participates with conservative tier
 *   D (<40): Minimal data — does NOT participate in HS scoring (hsImpactEnabled=false)
 */

export type HsQualityGrade = 'A' | 'B' | 'C' | 'D';

export interface HsQualityResult {
  /** Quality score 0-100 */
  score: number;
  /** Quality grade letter */
  grade: HsQualityGrade;
  /** Critical fields that are missing (evaluation dimensions) */
  missingCritical: string[];
  /** Optional fields that are missing (supplementary data) */
  missingOptional: string[];
}

/** Input shape for quality assessment — accepts any superset (e.g. Prisma model) */
export interface HsQualityInput {
  name?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  type?: string | null;
  nameZh?: string | null;
  website?: string | null;
  // Evaluation dimensions
  recognition?: number | null;
  academicRigor?: number | null;
  placementRecord?: number | null;
  studentQuality?: number | null;
  resources?: number | null;
  // Supplementary
  gradeInflation?: string | null;
  tier?: number | null;
  evaluatedBy?: string | null;
  avgSatScore?: number | null;
  avgIbScore?: number | null;
}

/**
 * Compute a quality score for high school data.
 *
 * Point allocation:
 *   Core identity (25 pts): name (10), country (5), type (5), state/city (5)
 *   Evaluation dimensions (50 pts): 10 pts each × 5 dimensions
 *   Supplementary data (25 pts): gradeInflation (5), tier (5), evaluatedBy (5),
 *     website (3), avgSat/avgIb (4), nameZh (3)
 */
export function computeHsQualityScore(school: HsQualityInput): HsQualityResult {
  let score = 0;

  // === Core Identity (25 pts) ===
  if (school.name) score += 10;
  if (school.country) score += 5;
  if (school.type) score += 5;
  if (school.state || school.city) score += 5;

  // === Evaluation Dimensions (50 pts) ===
  if (school.recognition != null) score += 10;
  if (school.academicRigor != null) score += 10;
  if (school.placementRecord != null) score += 10;
  if (school.studentQuality != null) score += 10;
  if (school.resources != null) score += 10;

  // === Supplementary Data (25 pts) ===
  if (school.gradeInflation) score += 5;
  if (school.tier != null) score += 5;
  if (school.evaluatedBy) score += 5;
  if (school.website) score += 3;
  if (school.avgSatScore != null || school.avgIbScore != null) score += 4;
  if (school.nameZh) score += 3;

  // Grade thresholds
  const grade: HsQualityGrade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';

  // Missing field analysis
  const missingCritical: string[] = [];
  if (school.recognition == null) missingCritical.push('recognition');
  if (school.academicRigor == null) missingCritical.push('academicRigor');
  if (school.placementRecord == null) missingCritical.push('placementRecord');
  if (school.studentQuality == null) missingCritical.push('studentQuality');
  if (school.resources == null) missingCritical.push('resources');

  const missingOptional: string[] = [];
  if (!school.gradeInflation) missingOptional.push('gradeInflation');
  if (!school.website) missingOptional.push('website');
  if (!school.nameZh) missingOptional.push('nameZh');
  if (school.avgSatScore == null && school.avgIbScore == null) {
    missingOptional.push('avgSatScore/avgIbScore');
  }
  if (!school.evaluatedBy) missingOptional.push('evaluatedBy');

  return { score, grade, missingCritical, missingOptional };
}

/** Quality grade thresholds for routing decisions */
export const HS_QUALITY_THRESHOLDS = {
  /** A: Full participation in scoring */
  FULL: 80,
  /** B: Partial evaluation, flagged */
  PARTIAL: 60,
  /** C: Conservative defaults */
  MINIMAL: 40,
  /** Below C: Does not participate in HS scoring */
} as const;
