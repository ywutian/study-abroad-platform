import { Injectable } from '@nestjs/common';
import { School } from '@prisma/client';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import {
  ProfileMetrics,
  SchoolMetrics,
  TIER_POINTS,
  LEVEL_POINTS,
} from './utils/score-calculator';
import { clampPercentRate } from '../../common/utils/percent.util';
import { detectInternationalStatus } from '@study-abroad/shared/scoring';
import type { ProfileWithRelations } from './prediction.types';

/**
 * Pure data transformation service for prediction engines.
 *
 * Converts Prisma entities to internal prediction DTOs and extracts
 * numeric metrics used by statistical, AI, and ML engines.
 */
@Injectable()
export class PredictionTransformerService {
  /**
   * Convert a Prisma profile (with relations) to the internal ProfileInput format
   * used by prediction engines and prompt builders.
   *
   * @param profile - Prisma profile with testScores, activities, and awards relations
   * @returns Normalized ProfileInput for prediction calculations
   */
  profileToInput(profile: ProfileWithRelations): ProfileInput {
    // Extract high school education entry (first HIGH_SCHOOL type)
    const hsEducation = (profile as any).education?.find(
      (e: any) => e.schoolType === 'HIGH_SCHOOL',
    );
    const hs = hsEducation?.highSchool;

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
      grade: profile.grade ?? undefined,
      currentSchoolType: profile.currentSchoolType ?? undefined,
      targetMajor: profile.targetMajor ?? undefined,
      isInternational: intlContext.isInternational,
      nationality: (profile as any).nationality ?? undefined,
      educationSystem: (profile as any).educationSystem ?? undefined,
      needsFinancialAid: (profile as any).needsFinancialAid ?? undefined,
      highSchoolName: hsEducation?.schoolName ?? undefined,
      highSchoolTier: hs?.tier ?? undefined,
      highSchoolType: hs?.type ?? undefined,
      highSchoolLocation: hs?.state || hs?.country || undefined,
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
    };
  }

  /**
   * Convert a Prisma School entity to the internal SchoolInput format.
   *
   * @param school - Prisma School entity
   * @returns Normalized SchoolInput for prediction calculations
   */
  schoolToInput(school: School): SchoolInput {
    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      acceptanceRate: clampPercentRate(school.acceptanceRate),
      intlAcceptanceRate: clampPercentRate((school as any).intlAcceptanceRate),
      intlStudentPct: (school as any).intlStudentPct
        ? Number((school as any).intlStudentPct)
        : undefined,
      needBlindInternational:
        (school as any).needBlindInternational || undefined,
      satAvg: school.satAvg ?? undefined,
      sat25: school.sat25 ?? undefined,
      sat75: school.sat75 ?? undefined,
      actAvg: school.actAvg ?? undefined,
      act25: school.act25 ?? undefined,
      act75: school.act75 ?? undefined,
      usNewsRank: school.usNewsRank ?? undefined,
      graduationRate: clampPercentRate(school.graduationRate),
      retentionRate: clampPercentRate((school as any).retentionRate),
      studentFacultyRatio: (school as any).studentFacultyRatio ?? undefined,
      percentNeedMet: clampPercentRate((school as any).percentNeedMet),
      averageNetPrice: (school as any).averageNetPrice ?? undefined,
      testOptional: (school as any).testOptional ?? undefined,
      hasEarlyDecision: (school as any).hasEarlyDecision ?? undefined,
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

    const awardTierScores = profile.awards.map((a) => {
      if (a.tier)
        return TIER_POINTS[a.tier] ?? LEVEL_POINTS[a.level ?? ''] ?? 3;
      return LEVEL_POINTS[a.level ?? ''] ?? 3;
    });

    return {
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      satScore,
      actScore,
      toeflScore,
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
   * Profile data contributes up to 60 points: GPA (15), SAT/ACT (15), TOEFL (5),
   * activities (10), awards (10), target major (5). School data contributes up to
   * 40 points: acceptance rate (10), ranking (10), SAT range (10), ACT range (10).
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @returns Completeness score from 0 to 100
   */
  evaluateDataCompleteness(profile: ProfileInput, school: SchoolInput): number {
    let score = 0;
    const maxScore = 100;

    // Profile 数据 (60 分)
    if (profile.gpa) score += 15;
    if (profile.testScores.some((s) => s.type === 'SAT' || s.type === 'ACT'))
      score += 15;
    if (profile.testScores.some((s) => s.type === 'TOEFL')) score += 5;
    if (profile.activities.length > 0) score += 10;
    if (profile.awards.length > 0) score += 10;
    if (profile.targetMajor) score += 5;

    // School 数据 (40 分)
    if (school.acceptanceRate) score += 10;
    if (school.graduationRate) score += 10;
    if (school.satAvg || (school.sat25 && school.sat75)) score += 10;
    if (school.actAvg || (school.act25 && school.act75)) score += 10;

    return Math.min(maxScore, score);
  }
}
