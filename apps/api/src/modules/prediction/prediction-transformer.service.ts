import { Injectable } from '@nestjs/common';
import { School } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import {
  ProfileMetrics,
  SchoolMetrics,
  TIER_POINTS,
  LEVEL_POINTS,
} from './utils/score-calculator';
import { clampPercentRate } from '../../common/utils/percent.util';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  detectInternationalStatus,
  getBestEnglishProficiency,
} from '@study-abroad/shared/scoring';
import {
  TRUST_TIER_PREDICTION_WEIGHT,
  isPredictionEligibleTrustTier,
  resolveSchoolTestingPolicyValue,
  toLegacyTestOptionalFlag,
} from '@study-abroad/shared/utils';
import type { ProfileWithRelations } from './prediction.types';
import { getNormalizedFieldProvenance } from '../school/school-provenance.helpers';

type ConfidenceLevel = 'low' | 'medium' | 'high';

const SCHOOL_CONFIDENCE_LOW_WEIGHT = 0.6;
const SCHOOL_CONFIDENCE_DOWNGRADE_WEIGHT = 0.85;

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value) return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return undefined;
}

/**
 * Pure data transformation service for prediction engines.
 *
 * Converts Prisma entities to internal prediction DTOs and extracts
 * numeric metrics used by statistical, AI, and ML engines.
 */
@Injectable()
export class PredictionTransformerService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTrustedSchoolField<T, R = T>(
    school: School,
    field: string,
    value: T | null | undefined,
    transform?: (value: T) => R | undefined,
  ): { value: R | undefined; weight?: number } {
    if (value == null) {
      return { value: undefined };
    }

    const provenance = getNormalizedFieldProvenance(
      school as Record<string, unknown>,
      field,
    );
    if (!provenance) {
      return { value: transform ? transform(value) : (value as unknown as R) };
    }

    const weight = TRUST_TIER_PREDICTION_WEIGHT[provenance.tier];
    if (!isPredictionEligibleTrustTier(provenance.tier)) {
      return { value: undefined, weight };
    }

    return {
      value: transform ? transform(value) : (value as unknown as R),
      weight,
    };
  }

  private getFeatureWeight(school: SchoolInput, fields: string[]): number {
    const weights = fields
      .map((field) => school.fieldTrustWeights?.[field])
      .filter((weight): weight is number => typeof weight === 'number');

    if (weights.length === 0) {
      return 1;
    }

    return weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
  }

  getAveragePredictionWeight(school: SchoolInput): number {
    if (typeof school.averagePredictionWeight === 'number') {
      return school.averagePredictionWeight;
    }

    const weights = Object.values(school.fieldTrustWeights ?? {}).filter(
      (weight): weight is number => typeof weight === 'number',
    );

    if (weights.length === 0) {
      return 1;
    }

    return weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
  }

  adjustConfidenceForSchoolTrust(
    confidence: ConfidenceLevel,
    school: SchoolInput,
  ): ConfidenceLevel {
    const averageWeight = this.getAveragePredictionWeight(school);

    if (averageWeight < SCHOOL_CONFIDENCE_LOW_WEIGHT) {
      return 'low';
    }

    if (averageWeight < SCHOOL_CONFIDENCE_DOWNGRADE_WEIGHT) {
      if (confidence === 'high') return 'medium';
      if (confidence === 'medium') return 'low';
    }

    return confidence;
  }

  /**
   * Convert a Prisma profile (with relations) to the internal ProfileInput format
   * used by prediction engines and prompt builders.
   *
   * @param profile - Prisma profile with testScores, activities, and awards relations
   * @returns Normalized ProfileInput for prediction calculations
   */
  profileToInput(
    profile: ProfileWithRelations,
    assessmentData?: { mbtiType?: string; hollandCodes?: string[] },
  ): ProfileInput {
    // Extract the most recent high school education entry.
    // Sort by createdAt desc to pick the latest when multiple exist.
    const hsEducations = ((profile as any).education || [])
      .filter((e: any) => e.schoolType === 'HIGH_SCHOOL')
      .sort((a: any, b: any) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    const hsEducation = hsEducations[0];
    const hsRaw = hsEducation?.highSchool;
    // Quality gate: D-grade schools (hsImpactEnabled=false) are excluded from predictions
    const hs = hsRaw?.hsImpactEnabled === false ? undefined : hsRaw;

    const intlContext = detectInternationalStatus({
      nationality: (profile as any).nationality,
      countryOfResidence: (profile as any).countryOfResidence,
      citizenship: (profile as any).citizenship,
      educationSystem: (profile as any).educationSystem,
      currentSchoolType: profile.currentSchoolType,
    });

    return {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      gpaSystem: hsEducation?.gpaSystem,
      grade: profile.grade ?? undefined,
      currentSchoolType: profile.currentSchoolType ?? undefined,
      targetMajor: profile.targetMajor ?? profile.intendedMajor ?? undefined,
      isInternational: intlContext.isInternational,
      nationality: (profile as any).nationality ?? undefined,
      educationSystem: (profile as any).educationSystem ?? undefined,
      needsFinancialAid: (profile as any).needsFinancialAid ?? undefined,
      highSchoolId: hs?.id ?? undefined,
      highSchoolName: hsEducation?.schoolName ?? undefined,
      highSchoolTier: hs?.tier ?? undefined,
      highSchoolType: hs?.type ?? undefined,
      highSchoolLocation: hs?.state || hs?.country || undefined,
      highSchoolRecognition: hs?.recognition ?? undefined,
      highSchoolAcademicRigor: hs?.academicRigor ?? undefined,
      highSchoolPlacementRecord: hs?.placementRecord ?? undefined,
      highSchoolStudentQuality: hs?.studentQuality ?? undefined,
      highSchoolResources: hs?.resources ?? undefined,
      highSchoolGradeInflation: hs?.gradeInflation ?? undefined,
      testScores: (profile.testScores || []).map((s) => ({
        type: s.type,
        score: s.score,
        subScores: s.subScores as Record<string, number> | undefined,
      })),
      activities: (profile.activities || []).map((a) => ({
        name: a.name,
        category: a.category,
        role: a.role,
        description: a.description ?? undefined,
        hoursPerWeek: a.hoursPerWeek ?? undefined,
        weeksPerYear: a.weeksPerYear ?? undefined,
      })),
      awards: (profile.awards || []).map((a) => ({
        level: a.level,
        name: a.name,
        tier: a.competition?.tier ?? undefined,
        competitionName: a.competition?.name ?? undefined,
      })),
      assessment: assessmentData,
      isLegacy: (profile as any).legacy?.length > 0,
      legacySchools:
        (profile as any).legacy?.length > 0
          ? (profile as any).legacy
          : undefined,
      isFirstGen: (profile as any).firstGeneration ?? false,
      recruitedAthlete: (profile as any).recruitedAthlete ?? false,
      urmStatus: (profile as any).urmStatus ?? null,
      // PR-14: explicit "applying test-optional" flag triggers 0.85× modifier
      // at <20% admit schools per Common App data.
      applyingTestOptional: (profile as any).applyingTestOptional ?? false,
    };
  }

  /**
   * Convert a Prisma School entity to the internal SchoolInput format.
   *
   * @param school - Prisma School entity
   * @returns Normalized SchoolInput for prediction calculations
   */
  schoolToInput(school: School): SchoolInput {
    const fieldTrustWeights: Record<string, number> = {};
    const captureField = <T, R = T>(
      field: string,
      value: T | null | undefined,
      transform?: (raw: T) => R | undefined,
    ): R | undefined => {
      const resolved = this.resolveTrustedSchoolField(
        school,
        field,
        value,
        transform,
      );
      if (resolved.value !== undefined && typeof resolved.weight === 'number') {
        fieldTrustWeights[field] = resolved.weight;
      }
      return resolved.value;
    };

    const testingPolicy =
      captureField('testingPolicy', (school as any).testingPolicy) ??
      resolveSchoolTestingPolicyValue({
        testingPolicy: (school as any).testingPolicy,
        testOptional: (school as any).testOptional,
      });

    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      country: (school as any).country ?? undefined,
      state: (school as any).state ?? undefined,
      isPrivate: (school as any).isPrivate ?? undefined,
      acceptanceRate: captureField(
        'acceptanceRate',
        school.acceptanceRate,
        (value) => clampPercentRate(toNumber(value)) as any,
      ),
      intlAcceptanceRate: captureField(
        'intlAcceptanceRate',
        (school as any).intlAcceptanceRate,
        (value) => clampPercentRate(toNumber(value)) as any,
      ),
      intlStudentPct: captureField(
        'intlStudentPct',
        (school as any).intlStudentPct,
        (value) => Number(value) as any,
      ),
      needBlindInternational: captureField(
        'needBlindInternational',
        (school as any).needBlindInternational,
      ),
      satAvg: captureField('satAvg', school.satAvg),
      sat25: captureField('sat25', school.sat25),
      sat75: captureField('sat75', school.sat75),
      actAvg: captureField('actAvg', school.actAvg),
      act25: captureField('act25', school.act25),
      act75: captureField('act75', school.act75),
      usNewsRank: captureField('usNewsRank', school.usNewsRank),
      graduationRate: captureField(
        'graduationRate',
        school.graduationRate,
        (value) => clampPercentRate(toNumber(value)) as any,
      ),
      retentionRate: captureField(
        'retentionRate',
        (school as any).retentionRate,
        (value) => clampPercentRate(toNumber(value)) as any,
      ),
      studentFacultyRatio: captureField(
        'studentFacultyRatio',
        (school as any).studentFacultyRatio,
      ),
      percentNeedMet: captureField(
        'percentNeedMet',
        (school as any).percentNeedMet,
        (value) => clampPercentRate(toNumber(value)) as any,
      ),
      averageNetPrice: captureField(
        'averageNetPrice',
        (school as any).averageNetPrice,
      ),
      testingPolicy,
      testOptional: toLegacyTestOptionalFlag({
        testingPolicy,
        testOptional: captureField(
          'testOptional',
          (school as any).testOptional,
        ),
      }),
      hasEarlyDecision: captureField(
        'hasEarlyDecision',
        (school as any).hasEarlyDecision,
      ),
      fieldTrustWeights,
      averagePredictionWeight:
        Object.keys(fieldTrustWeights).length > 0
          ? Object.values(fieldTrustWeights).reduce(
              (sum, weight) => sum + weight,
              0,
            ) / Object.values(fieldTrustWeights).length
          : 1,
    };
  }

  /**
   * Extract numeric metrics from a ProfileInput for use in statistical calculations.
   *
   * Pulls SAT, ACT, TOEFL scores from testScores array and counts activities/awards
   * by level (national, international).
   *
   * @param profile - The normalized profile input
   * @returns ProfileMetrics with scores, counts, and award breakdowns
   */
  extractProfileMetrics(profile: ProfileInput): ProfileMetrics {
    const satScore = profile.testScores.find((s) => s.type === 'SAT')?.score;
    const actScore = profile.testScores.find((s) => s.type === 'ACT')?.score;
    const toeflScore = profile.testScores.find(
      (s) => s.type === 'TOEFL',
    )?.score;

    // Unified English proficiency: pick the best of TOEFL/IELTS/Duolingo
    const bestEnglish = getBestEnglishProficiency(profile.testScores);
    const englishProficiencyScore = bestEnglish?.normalized;

    const awardTierScores = profile.awards.map((a) => {
      if (a.tier)
        return TIER_POINTS[a.tier] ?? LEVEL_POINTS[a.level ?? ''] ?? 3;
      return LEVEL_POINTS[a.level ?? ''] ?? 3;
    });

    return {
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      gpaSystem: profile.gpaSystem,
      satScore,
      actScore,
      toeflScore,
      englishProficiencyScore,
      activityCount: profile.activities.length,
      activityDetails: profile.activities.map((a) => ({
        category: a.category || '',
        role: a.role || '',
        totalHours: (a.hoursPerWeek ?? 0) * (a.weeksPerYear ?? 0),
        tier: (a as any).activityTemplate?.tier ?? undefined,
      })),
      awardCount: profile.awards.length,
      nationalAwardCount: profile.awards.filter((a) => a.level === 'NATIONAL')
        .length,
      internationalAwardCount: profile.awards.filter(
        (a) => a.level === 'INTERNATIONAL',
      ).length,
      awardTierScores,
      highSchoolTier: profile.highSchoolTier,
      highSchoolType: profile.highSchoolType,
      highSchoolRecognition: profile.highSchoolRecognition,
      highSchoolAcademicRigor: profile.highSchoolAcademicRigor,
      highSchoolPlacementRecord: profile.highSchoolPlacementRecord,
      highSchoolStudentQuality: profile.highSchoolStudentQuality,
      highSchoolResources: profile.highSchoolResources,
      highSchoolGradeInflation: profile.highSchoolGradeInflation,
      isLegacy: profile.isLegacy,
      isFirstGen: profile.isFirstGen,
      needsFinancialAid: profile.needsFinancialAid,
    };
  }

  /**
   * Extract numeric metrics from a SchoolInput for use in statistical calculations.
   *
   * @param school - The normalized school input
   * @returns SchoolMetrics including acceptance rate, test score ranges, and ranking
   */
  extractSchoolMetrics(school: SchoolInput): SchoolMetrics {
    return {
      acceptanceRate: school.acceptanceRate,
      satAvg: school.satAvg,
      sat25: school.sat25,
      sat75: school.sat75,
      actAvg: school.actAvg,
      act25: school.act25,
      act75: school.act75,
      usNewsRank: school.usNewsRank,
      graduationRate: school.graduationRate,
    };
  }

  /**
   * Evaluate how complete the available profile and school data is on a 0-100 scale.
   *
   * Profile data contributes up to 68 points: GPA (15), GPA system (3),
   * SAT/ACT (15), TOEFL (5), activities (10), awards (10), target major (5),
   * high school background (5). School data contributes up to 40 points:
   * acceptance rate (10), ranking (10), SAT range (10), ACT range (10).
   *
   * Raw score is normalized to 0-100 from a max of 108.
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @returns Completeness score from 0 to 100
   */
  evaluateDataCompleteness(profile: ProfileInput, school: SchoolInput): number {
    let score = 0;
    const maxScore = 108;

    // Profile 数据 (68 分)
    if (profile.gpa) score += 15;
    if (profile.gpaSystem) score += 3;
    if (profile.testScores.some((s) => s.type === 'SAT' || s.type === 'ACT'))
      score += 15;
    if (
      profile.testScores.some(
        (s) =>
          s.type === 'TOEFL' || s.type === 'IELTS' || s.type === 'DUOLINGO',
      )
    )
      score += 5;
    if (profile.activities.length > 0) score += 10;
    if (profile.awards.length > 0) score += 10;
    if (profile.targetMajor) score += 5;
    if (profile.highSchoolTier || profile.highSchoolName) score += 5;

    // School 数据 (40 分)
    if (school.acceptanceRate != null) {
      score += 10 * this.getFeatureWeight(school, ['acceptanceRate']);
    }
    if (school.graduationRate != null) {
      score += 10 * this.getFeatureWeight(school, ['graduationRate']);
    }
    if (
      school.satAvg != null ||
      (school.sat25 != null && school.sat75 != null)
    ) {
      score +=
        10 *
        this.getFeatureWeight(
          school,
          school.satAvg != null ? ['satAvg'] : ['sat25', 'sat75'],
        );
    }
    if (
      school.actAvg != null ||
      (school.act25 != null && school.act75 != null)
    ) {
      score +=
        10 *
        this.getFeatureWeight(
          school,
          school.actAvg != null ? ['actAvg'] : ['act25', 'act75'],
        );
    }

    return Math.min(100, Math.round((score / maxScore) * 100));
  }

  /**
   * Enrich a ProfileInput with the latest essay AI review quality score.
   *
   * Queries the most recent EssayAIResult (type = 'review') for the given profile
   * and extracts the overallScore from the stored JSON scores field.
   *
   * @param profileInput - The profile input to enrich (mutated in place)
   * @param profileId - The Prisma profile ID used to find linked essays
   * @returns The enriched ProfileInput (same reference)
   */
  async enrichWithEssayQuality(
    profileInput: ProfileInput,
    profileId: string,
  ): Promise<ProfileInput> {
    try {
      const latestReview = await this.prisma.essayAIResult.findFirst({
        where: {
          essay: { profileId },
          type: 'review',
        },
        orderBy: { createdAt: 'desc' },
        select: { output: true },
      });

      if (latestReview?.output) {
        // The output is the raw LLM response — use extractJsonFromLlm for robust parsing
        const parsed = extractJsonFromLlm<{ overallScore?: number }>(
          latestReview.output,
        );
        if (parsed && typeof parsed.overallScore === 'number') {
          profileInput.essayQualityScore = parsed.overallScore;
        }
      }
    } catch {
      // Non-critical — essay quality is an optional enrichment
    }

    return profileInput;
  }
}
