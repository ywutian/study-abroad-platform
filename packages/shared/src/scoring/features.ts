/**
 * Feature Engineering for ML Prediction Models
 *
 * 44-feature vector extractable from both live profiles AND historical AdmissionCase records.
 * All features normalized to [0, 1] or small bounded range. Missing values → NaN.
 * Binary `has*` features encode missingness so the model can learn conditional behavior.
 */

import { LEADERSHIP_KEYWORDS } from './constants';
import type { ProfileMetrics, SchoolMetrics } from './types';
import { normalizeGpa } from './math';
import {
  calculateAcademicScore,
  calculateActivityScore,
  calculateAwardScore,
  calculateOverallScore,
  calculateProbability,
  calculateSelectivityIndex,
} from './score';

// ============================================
// Feature Vector Interface
// ============================================

export interface FeatureVector {
  // Academic (10)
  gpa4: number;
  satNorm: number;
  actNorm: number;
  toeflNorm: number;
  hasTestScore: number;
  hasToefl: number;
  testCompleteness: number;
  gpaAboveSchoolMedian: number;
  satAboveSchoolMedian: number;
  academicIndex: number;

  // Extracurricular (8)
  activityCount: number;
  leadershipRatio: number;
  deepEngagementRatio: number;
  categoryDiversity: number;
  hasActivities: number;
  activityTierScore: number;
  volunteerRatio: number;
  activityScore: number;

  // Awards (6)
  awardScore: number;
  hasIntlAward: number;
  hasNatlAward: number;
  maxAwardTier: number;
  awardCount: number;
  stemAwardRatio: number;

  // School (8)
  selectivity: number;
  acceptanceRate: number;
  satMidNorm: number;
  gradRateNorm: number;
  isPrivate: number;
  hasSchoolStats: number;
  usNewsRankNorm: number;
  tuitionNorm: number;

  // Interaction (8)
  gpaSatInteraction: number;
  testVsSchool: number;
  overallScore: number;
  heuristicProb: number;
  academicFit: number;
  profileCompleteness: number;
  awardSelectivityInteraction: number;
  activitySelectivityInteraction: number;

  // High School (1)
  highSchoolTierNorm: number;

  // Test Policy (1)
  isTestBlindSchool: number;

  // Application Context (4)
  roundED: number;
  roundEA: number;
  applicationYear: number;
  hasMajorDeclared: number;
}

/** Feature names for Tier 2 (basic, 20 features — most impactful, least sparse) */
export const FEATURE_NAMES_BASIC: (keyof FeatureVector)[] = [
  'gpa4',
  'satNorm',
  'actNorm',
  'toeflNorm',
  'hasTestScore',
  'hasToefl',
  'activityCount',
  'hasActivities',
  'awardScore',
  'hasIntlAward',
  'hasNatlAward',
  'awardCount',
  'selectivity',
  'acceptanceRate',
  'satMidNorm',
  'hasSchoolStats',
  'testVsSchool',
  'overallScore',
  'heuristicProb',
  'academicFit',
  'isTestBlindSchool',
];

/** Feature names for Tier 3+ (full 44 features) */
export const FEATURE_NAMES_FULL: (keyof FeatureVector)[] = [
  // Academic
  'gpa4',
  'satNorm',
  'actNorm',
  'toeflNorm',
  'hasTestScore',
  'hasToefl',
  'testCompleteness',
  'gpaAboveSchoolMedian',
  'satAboveSchoolMedian',
  'academicIndex',
  // Extracurricular
  'activityCount',
  'leadershipRatio',
  'deepEngagementRatio',
  'categoryDiversity',
  'hasActivities',
  'activityTierScore',
  'volunteerRatio',
  'activityScore',
  // Awards
  'awardScore',
  'hasIntlAward',
  'hasNatlAward',
  'maxAwardTier',
  'awardCount',
  'stemAwardRatio',
  // School
  'selectivity',
  'acceptanceRate',
  'satMidNorm',
  'gradRateNorm',
  'isPrivate',
  'hasSchoolStats',
  'usNewsRankNorm',
  'tuitionNorm',
  // Interaction
  'gpaSatInteraction',
  'testVsSchool',
  'overallScore',
  'heuristicProb',
  'academicFit',
  'profileCompleteness',
  'awardSelectivityInteraction',
  'activitySelectivityInteraction',
  // High School
  'highSchoolTierNorm',
  // Test Policy
  'isTestBlindSchool',
  // Application Context
  'roundED',
  'roundEA',
  'applicationYear',
  'hasMajorDeclared',
];

// ============================================
// Feature Extraction Options
// ============================================

export interface FeatureExtractionOptions {
  activityDetails?: Array<{ category: string; role: string; totalHours: number; tier?: number }>;
  round?: string;
  year?: number;
  major?: string;
  isPrivateSchool?: boolean;
  tuition?: number;
  usNewsRank?: number;
}

// ============================================
// Main Extraction Function
// ============================================

/**
 * Extract a 44-feature vector from a student profile and school metrics.
 * Used for live predictions.
 */
export function extractFeatureVector(
  profile: ProfileMetrics,
  school: SchoolMetrics,
  opts: FeatureExtractionOptions = {}
): FeatureVector {
  // ---------- Academic features ----------
  const gpa4 =
    profile.gpa != null
      ? normalizeGpa(profile.gpa, profile.gpaScale ?? 4.0, profile.gpaSystem) / 4.0
      : NaN;
  // Test-blind schools: SAT/ACT are not applicable — zero out test features
  const isTestBlindSchool = (school as any).testingPolicy === 'BLIND' ? 1 : 0;
  const satNorm = !isTestBlindSchool && profile.satScore != null ? profile.satScore / 1600 : NaN;
  const actNorm = !isTestBlindSchool && profile.actScore != null ? profile.actScore / 36 : NaN;
  const toeflNorm =
    profile.englishProficiencyScore != null
      ? profile.englishProficiencyScore
      : profile.toeflScore != null
        ? profile.toeflScore / 120
        : NaN;
  const hasTestScore = isTestBlindSchool ? 0 : (profile.satScore != null || profile.actScore != null ? 1 : 0);
  const hasToefl = profile.englishProficiencyScore != null || profile.toeflScore != null ? 1 : 0;

  let testCount = 0;
  if (profile.satScore != null) testCount++;
  if (profile.actScore != null) testCount++;
  if (profile.toeflScore != null) testCount++;
  const testCompleteness = testCount / 3;

  // Cross-features: student vs school
  const schoolSatMid = getSchoolSatMid(school);
  const schoolSatIqr =
    school.sat25 != null && school.sat75 != null ? school.sat75 - school.sat25 : null;

  let gpaAboveSchoolMedian = 0;
  if (!isNaN(gpa4) && school.acceptanceRate != null) {
    // Rough approximation: higher selectivity → higher GPA expectation
    const selectivity = calculateSelectivityIndex(school);
    const expectedGpa = 0.7 + selectivity * 0.25; // ~0.7 to ~0.95 on 4.0 scale /4
    gpaAboveSchoolMedian = clamp((gpa4 - expectedGpa) * 10, -3, 3);
  }

  let satAboveSchoolMedian = 0;
  if (profile.satScore != null && schoolSatMid != null) {
    if (schoolSatIqr != null && schoolSatIqr > 0) {
      satAboveSchoolMedian = clamp((profile.satScore - schoolSatMid) / schoolSatIqr, -3, 3);
    } else {
      satAboveSchoolMedian = clamp((profile.satScore - schoolSatMid) / 200, -3, 3);
    }
  }

  const academicIndex = calculateAcademicScore(profile, school) / 100;

  // ---------- Extracurricular features ----------
  const details = opts.activityDetails;
  const actCount = Math.min(profile.activityCount, 15) / 15;
  let leadershipRatio = 0;
  let deepEngagementRatio = 0;
  let categoryDiversity = 0;
  let activityTierScore = 0;
  let volunteerRatio = 0;

  if (details && details.length > 0) {
    const leaderCount = details.filter((a) =>
      LEADERSHIP_KEYWORDS.some((kw) => a.role.toLowerCase().includes(kw as string))
    ).length;
    leadershipRatio = leaderCount / details.length;

    const deepCount = details.filter((a) => a.totalHours > 200).length;
    deepEngagementRatio = deepCount / details.length;

    const uniqueCategories = new Set(details.map((a) => a.category)).size;
    categoryDiversity = Math.min(uniqueCategories, 8) / 8;

    // Activity tier scoring: use real tier when available, heuristic fallback
    const TIER_WEIGHTS: Record<number, number> = { 1: 10, 2: 7, 3: 4, 4: 1 };
    const tierScoreRaw = details.reduce((sum, a) => {
      if (a.tier && TIER_WEIGHTS[a.tier]) return sum + TIER_WEIGHTS[a.tier];
      const isLeader = LEADERSHIP_KEYWORDS.some((kw) =>
        a.role.toLowerCase().includes(kw as string)
      );
      const isDeep = a.totalHours > 200;
      if (isLeader && isDeep) return sum + 10;
      if (isLeader || isDeep) return sum + 6;
      if (a.totalHours > 100) return sum + 3;
      return sum + 1;
    }, 0);
    const maxTierScore = details.length * 10;
    activityTierScore = maxTierScore > 0 ? tierScoreRaw / maxTierScore : 0;

    // Volunteer ratio (heuristic: category or role contains volunteer keywords)
    const volunteerCount = details.filter(
      (a) =>
        a.category.toLowerCase().includes('volunteer') ||
        a.category.toLowerCase().includes('community') ||
        a.role.toLowerCase().includes('volunteer')
    ).length;
    volunteerRatio = volunteerCount / details.length;
  }

  const hasActivities = profile.activityCount > 0 ? 1 : 0;
  const activityScoreVal = calculateActivityScore(profile) / 100;

  // ---------- Award features ----------
  const awardScoreVal = calculateAwardScore(profile) / 100;
  const hasIntlAward = profile.internationalAwardCount > 0 ? 1 : 0;
  const hasNatlAward = profile.nationalAwardCount > 0 ? 1 : 0;
  const maxAwardTier =
    profile.awardTierScores && profile.awardTierScores.length > 0
      ? Math.min(Math.max(...profile.awardTierScores) / 25, 1) // tier5=25pts → 1.0
      : 0;
  const awardCountNorm = Math.min(profile.awardCount, 10) / 10;
  const stemAwardRatio = 0; // Would need award category data; default 0

  // ---------- School features ----------
  const selectivity = calculateSelectivityIndex(school);
  const acceptanceRateNorm = school.acceptanceRate != null ? school.acceptanceRate / 100 : NaN;
  const satMidNorm = schoolSatMid != null ? schoolSatMid / 1600 : NaN;
  const gradRateNorm = school.graduationRate != null ? school.graduationRate / 100 : NaN;
  const isPrivate = opts.isPrivateSchool ? 1 : 0;
  const hasSchoolStats =
    school.acceptanceRate != null && (school.satAvg != null || school.sat25 != null) ? 1 : 0;
  const usNewsRankNorm = opts.usNewsRank != null ? clamp(1 - opts.usNewsRank / 300, 0, 1) : 0;
  const tuitionNorm = opts.tuition != null ? clamp(opts.tuition / 80000, 0, 1) : NaN;

  // ---------- Interaction features ----------
  const gpaSatInteraction = !isNaN(gpa4) && !isNaN(satNorm) ? gpa4 * satNorm : 0;
  const testVsSchool =
    profile.satScore != null && schoolSatMid != null
      ? clamp((profile.satScore - schoolSatMid) / 400, -1, 1)
      : 0;
  const overallScoreVal = calculateOverallScore(profile, school) / 100;
  const heuristicProbVal = calculateProbability(overallScoreVal * 100, school);
  const academicFitVal = gpaAboveSchoolMedian * 0.5 + satAboveSchoolMedian * 0.5;

  // Profile completeness
  let profileFields = 0;
  const profileTotal = 6; // gpa, sat, act, toefl, activities, awards
  if (profile.gpa != null) profileFields++;
  if (profile.satScore != null) profileFields++;
  if (profile.actScore != null) profileFields++;
  if (profile.toeflScore != null) profileFields++;
  if (profile.activityCount > 0) profileFields++;
  if (profile.awardCount > 0) profileFields++;
  const profileCompletenessVal = profileFields / profileTotal;

  const awardSelectivityInteraction = awardScoreVal * selectivity;
  const activitySelectivityInteraction = activityScoreVal * selectivity;

  // ---------- High School ----------
  const highSchoolTierNorm = profile.highSchoolTier ? (profile.highSchoolTier - 1) / 4 : 0.5;

  // ---------- Application context ----------
  const round = opts.round?.toUpperCase() ?? '';
  const roundED = round === 'ED' || round === 'ED1' || round === 'ED2' ? 1 : 0;
  const roundEA = round === 'EA' || round === 'REA' || round === 'SCEA' ? 1 : 0;
  const applicationYear = opts.year != null ? clamp((opts.year - 2020) / 10, -0.5, 1.5) : 0;
  const hasMajorDeclared = opts.major != null && opts.major.length > 0 ? 1 : 0;

  return {
    gpa4,
    satNorm,
    actNorm,
    toeflNorm,
    hasTestScore,
    hasToefl,
    testCompleteness,
    gpaAboveSchoolMedian,
    satAboveSchoolMedian,
    academicIndex,
    activityCount: actCount,
    leadershipRatio,
    deepEngagementRatio: deepEngagementRatio,
    categoryDiversity,
    hasActivities,
    activityTierScore,
    volunteerRatio,
    activityScore: activityScoreVal,
    awardScore: awardScoreVal,
    hasIntlAward,
    hasNatlAward,
    maxAwardTier,
    awardCount: awardCountNorm,
    stemAwardRatio,
    selectivity,
    acceptanceRate: acceptanceRateNorm,
    satMidNorm,
    gradRateNorm,
    isPrivate,
    hasSchoolStats,
    usNewsRankNorm,
    tuitionNorm,
    gpaSatInteraction,
    testVsSchool,
    overallScore: overallScoreVal,
    heuristicProb: heuristicProbVal,
    academicFit: academicFitVal,
    profileCompleteness: profileCompletenessVal,
    awardSelectivityInteraction,
    activitySelectivityInteraction,
    highSchoolTierNorm,
    isTestBlindSchool,
    roundED,
    roundEA,
    applicationYear,
    hasMajorDeclared,
  };
}

// ============================================
// Case-based Extraction (for training data)
// ============================================

export interface CaseRecord {
  gpaRange?: string | null;
  satRange?: string | null;
  actRange?: string | null;
  toeflRange?: string | null;
  tags: string[];
  result: string; // AdmissionResult enum value
  round?: string | null;
  year?: number | null;
  major?: string | null;
}

/**
 * Extract a FeatureVector from an AdmissionCase record (for training).
 * Cases store ranges ("3.8-4.0", "1500-1550") which we parse to midpoints.
 */
export function extractFeaturesFromCase(
  caseRecord: CaseRecord,
  school: SchoolMetrics,
  schoolOpts: { isPrivate?: boolean; tuition?: number; usNewsRank?: number } = {}
): { features: FeatureVector; label: number; weight: number } {
  // Parse ranges to midpoints
  const gpa = caseRecord.gpaRange ? parseRangeMidpoint(caseRecord.gpaRange) : undefined;
  const sat = caseRecord.satRange ? parseRangeMidpoint(caseRecord.satRange) : undefined;
  const act = caseRecord.actRange ? parseRangeMidpoint(caseRecord.actRange) : undefined;
  const toefl = caseRecord.toeflRange ? parseRangeMidpoint(caseRecord.toeflRange) : undefined;

  // Estimate activity/award counts from tags
  const tags = caseRecord.tags.map((t) => t.toLowerCase());
  const hasStrongActivities = tags.includes('strong_activities') || tags.includes('strong_ec');
  const hasAwards = tags.includes('national_award') || tags.includes('international_award');
  const isInternational = tags.includes('international');

  const profile: ProfileMetrics = {
    gpa: gpa,
    gpaScale: 4.0,
    satScore: sat,
    actScore: act,
    toeflScore: toefl,
    activityCount: hasStrongActivities ? 8 : 4,
    awardCount: hasAwards ? 3 : 0,
    nationalAwardCount: tags.includes('national_award') ? 2 : 0,
    internationalAwardCount: tags.includes('international_award') ? 1 : 0,
  };

  const features = extractFeatureVector(profile, school, {
    round: caseRecord.round ?? undefined,
    year: caseRecord.year ?? undefined,
    major: caseRecord.major ?? undefined,
    isPrivateSchool: schoolOpts.isPrivate,
    tuition: schoolOpts.tuition,
    usNewsRank: schoolOpts.usNewsRank,
  });

  // Label: 1 = admitted, 0 = rejected/waitlisted/deferred
  const label = caseRecord.result === 'ADMITTED' ? 1 : 0;

  // Weight: cases with more complete data get higher weight
  const completeness = [gpa, sat, act, toefl].filter((v) => v != null).length;
  const weight = completeness >= 2 ? 1.0 : 0.5;

  return { features, label, weight };
}

// ============================================
// Imputation
// ============================================

/**
 * Replace NaN values with medians from training data.
 * Binary `has*` features already encode missingness, so the model can learn
 * different behavior when data is present vs missing.
 */
export function imputeFeatures(
  features: FeatureVector,
  medians: Partial<Record<keyof FeatureVector, number>>
): FeatureVector {
  const result = { ...features };
  for (const key of Object.keys(result) as (keyof FeatureVector)[]) {
    if (Number.isNaN(result[key])) {
      result[key] = medians[key] ?? 0;
    }
  }
  return result;
}

/**
 * Compute per-feature medians from a set of feature vectors.
 * Used during training to create imputation values for serving.
 */
export function computeFeatureMedians(
  vectors: FeatureVector[]
): Record<keyof FeatureVector, number> {
  if (vectors.length === 0) {
    return getDefaultMedians();
  }

  const keys = Object.keys(vectors[0]) as (keyof FeatureVector)[];
  const medians = {} as Record<keyof FeatureVector, number>;

  for (const key of keys) {
    const values = vectors
      .map((v) => v[key])
      .filter((v) => !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      medians[key] = 0;
    } else {
      const mid = Math.floor(values.length / 2);
      medians[key] = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    }
  }

  return medians;
}

/**
 * Convert a FeatureVector to a numeric array using the given feature name list.
 */
export function featureVectorToArray(
  fv: FeatureVector,
  featureNames: (keyof FeatureVector)[]
): number[] {
  return featureNames.map((name) => fv[name]);
}

// ============================================
// Helpers
// ============================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSchoolSatMid(school: SchoolMetrics): number | null {
  if (school.sat25 != null && school.sat75 != null) {
    return (school.sat25 + school.sat75) / 2;
  }
  return school.satAvg ?? null;
}

function parseRangeMidpoint(range: string): number | undefined {
  const match = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    return (parseFloat(match[1]) + parseFloat(match[2])) / 2;
  }
  const single = parseFloat(range);
  return isNaN(single) ? undefined : single;
}

function getDefaultMedians(): Record<keyof FeatureVector, number> {
  return {
    gpa4: 0.88,
    satNorm: 0.88,
    actNorm: 0.83,
    toeflNorm: 0.88,
    hasTestScore: 1,
    hasToefl: 0.5,
    testCompleteness: 0.5,
    gpaAboveSchoolMedian: 0,
    satAboveSchoolMedian: 0,
    academicIndex: 0.6,
    activityCount: 0.4,
    leadershipRatio: 0.2,
    deepEngagementRatio: 0.15,
    categoryDiversity: 0.4,
    hasActivities: 0.8,
    activityTierScore: 0.3,
    volunteerRatio: 0.15,
    activityScore: 0.5,
    awardScore: 0.3,
    hasIntlAward: 0.1,
    hasNatlAward: 0.2,
    maxAwardTier: 0.2,
    awardCount: 0.2,
    stemAwardRatio: 0,
    selectivity: 0.5,
    acceptanceRate: 0.3,
    satMidNorm: 0.85,
    gradRateNorm: 0.8,
    isPrivate: 0.5,
    hasSchoolStats: 0.8,
    usNewsRankNorm: 0.5,
    tuitionNorm: 0.5,
    gpaSatInteraction: 0.75,
    testVsSchool: 0,
    overallScore: 0.5,
    heuristicProb: 0.4,
    academicFit: 0,
    profileCompleteness: 0.6,
    awardSelectivityInteraction: 0.15,
    activitySelectivityInteraction: 0.25,
    highSchoolTierNorm: 0.5,
    isTestBlindSchool: 0,
    roundED: 0,
    roundEA: 0,
    applicationYear: 0.5,
    hasMajorDeclared: 0.6,
  };
}
