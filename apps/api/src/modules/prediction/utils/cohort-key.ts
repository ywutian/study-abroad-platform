/**
 * Cohort-key derivation helpers used by the prediction system.
 *
 * The runtime cohort key is computed by `PredictionPolicyService.resolveCohortKey`
 * from a ProfileInput. This module provides a parallel implementation that
 * operates on the fields present on an AdmissionCase row, for use by:
 *
 *   - `scripts/backfill-cohort-priors.ts` — aggregates historical cases into
 *     SchoolCohortRoundPrior buckets.
 *   - (future) `CohortPriorTeacher` — reads those buckets as a distillation
 *     signal.
 *
 * Keeping both in a shared utility makes the decision tree unit-testable and
 * lets the policy service import it too if we ever consolidate. The constants
 * below MUST match `prediction-policy.service.ts:7-17`; a drift means backfilled
 * priors won't be found by the runtime's resolveCohortKey lookup.
 */

export const CHINA_CODES = new Set(['CN', 'CHN', 'CHINA', 'PRC']);
export const US_CODES = new Set(['US', 'USA', 'UNITED STATES']);
export const CHINA_INTL_SYSTEMS = new Set([
  'A_LEVEL',
  'IB',
  'AP',
  'CANADIAN',
  'AUSTRALIAN',
]);
export const CHINA_INTL_SCHOOL_TYPES = new Set(['INTERNATIONAL', 'INTL_CN']);
export const OVERSEAS_SCHOOL_TYPES = new Set([
  'US_HS',
  'BOARDING_US',
  'INTL_OTHER',
]);

/**
 * Subset of AdmissionCase fields required to derive a cohort key. A separate
 * type (rather than importing Prisma's AdmissionCase) keeps this module
 * script-safe — no Prisma client import required.
 */
export interface CaseCohortInput {
  nationality: string | null;
  curriculumType: string | null;
  highSchoolType: string | null;
  demographicTags: string[];
  /**
   * AdmissionCase joins HighSchool by highSchoolId; its `country` is the
   * closest proxy for Profile.highSchoolLocation. If the case was imported
   * without an HS relation, this will be null and the branch falls through
   * to the HS-type / tag heuristic.
   */
  highSchool: { country: string | null } | null;
}

/**
 * Mirror of `PredictionPolicyService.resolveCohortKey` adapted for
 * AdmissionCase fields.
 *
 * Key differences from the runtime version:
 *   - `highSchoolLocation` comes from the HighSchool relation (not a Profile
 *     field that's always populated).
 *   - `isInternational` is inferred from nationality + demographicTags because
 *     AdmissionCase does not carry an explicit flag.
 *
 * Returns null only if inputs can't form any valid cohort — today this never
 * happens in practice (the fallback is OTHER_INTL), but the API is kept
 * nullable so callers can treat "skip" uniformly with other error paths.
 */
export function deriveCohortKeyFromCase(c: CaseCohortInput): string | null {
  const nationality = c.nationality?.toUpperCase() ?? null;
  const educationSystem = c.curriculumType?.toUpperCase() ?? null;
  const currentSchoolType = c.highSchoolType?.toUpperCase() ?? null;
  const highSchoolLocation = c.highSchool?.country?.toUpperCase() ?? null;

  const isChinaApplicant = nationality ? CHINA_CODES.has(nationality) : false;
  const isUsContext =
    (highSchoolLocation && US_CODES.has(highSchoolLocation)) ||
    (currentSchoolType && OVERSEAS_SCHOOL_TYPES.has(currentSchoolType));

  if (isChinaApplicant && isUsContext) return 'CN__OVERSEAS_HS';
  if (
    isChinaApplicant &&
    ((educationSystem && CHINA_INTL_SYSTEMS.has(educationSystem)) ||
      (currentSchoolType && CHINA_INTL_SCHOOL_TYPES.has(currentSchoolType)))
  ) {
    return 'CN__CHINA_INTL';
  }
  if (isChinaApplicant) return 'CN__CHINA_LOCAL';

  const isInternational =
    c.demographicTags.includes('international') ||
    (nationality != null && !US_CODES.has(nationality));

  if (!isInternational) return 'US__US_HS';
  if (currentSchoolType && OVERSEAS_SCHOOL_TYPES.has(currentSchoolType)) {
    return 'US__OVERSEAS_HS';
  }

  return 'OTHER_INTL';
}

/**
 * Wilson score 95% confidence interval for a binomial proportion.
 *
 * Used instead of the naive normal approximation (p̂ ± z√(p̂(1-p̂)/n))
 * because it is well-behaved at the extremes (p near 0 or 1) and for small n,
 * both of which are common in per-school per-cohort admit-rate buckets.
 *
 *   p̂ = admits / total
 *   z = 1.96
 *   center = (p̂ + z²/(2n)) / (1 + z²/n)
 *   margin = z * sqrt( p̂(1-p̂)/n + z²/(4n²) ) / (1 + z²/n)
 */
export function wilsonInterval(
  admits: number,
  total: number,
): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 1 };
  const z = 1.96;
  const p = admits / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

/**
 * Bucket a sample count into the confidence tier used by
 * SchoolCohortRoundPrior.confidence. Thresholds: n≥30 high, n≥10 medium,
 * else low. MIN_SAMPLES=5 is enforced upstream in the backfill script so
 * we never actually write "below 5" priors.
 */
export function confidenceTier(total: number): 'low' | 'medium' | 'high' {
  if (total >= 30) return 'high';
  if (total >= 10) return 'medium';
  return 'low';
}
