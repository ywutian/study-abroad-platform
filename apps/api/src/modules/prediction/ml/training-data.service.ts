/**
 * Training Data Service
 *
 * Collects and prepares training data from two sources:
 * 1. PredictionResult records with verified outcome labels
 * 2. AdmissionCase records (admin-imported + user-submitted, verified)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../../common/constants/prisma-selects';
import {
  parseCaseTestScores,
  parseCaseActivities,
  parseCaseAwards,
} from '../../../common/constants/data-formats';
import {
  extractFeatureVector,
  extractFeaturesFromCase,
  computeFeatureMedians,
  featureVectorToArray,
  imputeFeatures,
  FEATURE_NAMES_BASIC,
  FEATURE_NAMES_FULL,
} from '@study-abroad/shared/scoring';
import type {
  FeatureVector,
  FeatureExtractionOptions,
  ProfileMetrics,
  SchoolMetrics,
} from '@study-abroad/shared/scoring';
import {
  resolveCanonicalPredictionOutcome,
  VERIFIED_OUTCOME_STATUSES,
} from '@study-abroad/shared/scoring';
import { validateDataset } from './data-validator';
import { determineTier } from './tier-strategy';

// ============================================
// Types
// ============================================

export interface TrainingRecord {
  features: FeatureVector;
  label: number;
  weight: number;
  source: 'prediction_outcome' | 'admission_case';
  deduplicationKey: string;
}

export interface PreparedDataset {
  X: number[][];
  y: number[];
  weights: number[];
  featureNames: (keyof FeatureVector)[];
  featureMedians: Record<string, number>;
  metadata: DatasetStats;
}

export interface DatasetStats {
  totalSamples: number;
  fromPredictions: number;
  fromCases: number;
  admittedCount: number;
  rejectedCount: number;
  admittedRatio: number;
  schoolCoverage: number;
  currentTier: 0 | 1 | 2 | 3 | 4;
  nextTierThreshold: number | null;
  bandDistribution: Array<{
    band: string;
    count: number;
    admitRate: number;
  }>;
  validation: ReturnType<typeof validateDataset>;
}

@Injectable()
export class TrainingDataService {
  private readonly logger = new Logger(TrainingDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Collect training data from both sources, deduplicate, validate.
   */
  async collectAll(): Promise<PreparedDataset> {
    const [predRecords, caseRecords] = await Promise.all([
      this.collectFromPredictions(),
      this.collectFromCases(),
    ]);

    // Merge and deduplicate (predictions take priority over cases for same user+school)
    const deduped = new Map<string, TrainingRecord>();
    for (const record of predRecords) {
      deduped.set(record.deduplicationKey, record);
    }
    for (const record of caseRecords) {
      if (!deduped.has(record.deduplicationKey)) {
        deduped.set(record.deduplicationKey, record);
      }
    }

    const allRecords = Array.from(deduped.values());
    this.logger.log(
      `Collected ${allRecords.length} training records ` +
        `(${predRecords.length} predictions, ${caseRecords.length} cases, ` +
        `${predRecords.length + caseRecords.length - allRecords.length} deduped)`,
    );

    // Determine tier to select feature set
    const tier = determineTier(allRecords.length);
    const featureNames =
      tier.tier <= 2 ? FEATURE_NAMES_BASIC : FEATURE_NAMES_FULL;

    // Compute medians for imputation
    const featureMedians = computeFeatureMedians(
      allRecords.map((r) => r.features),
    );

    // Impute and convert to arrays
    const X: number[][] = [];
    const y: number[] = [];
    const weights: number[] = [];

    for (const record of allRecords) {
      const imputed = imputeFeatures(record.features, featureMedians);
      X.push(featureVectorToArray(imputed, featureNames));
      y.push(record.label);
      weights.push(record.weight);
    }

    // Validate dataset
    const validation = validateDataset(
      allRecords.map((r) => r.features),
      allRecords.map((r) => r.label),
    );

    // Compute metadata
    const admittedCount = y.filter((v) => v === 1).length;
    const uniqueSchools = new Set(
      allRecords.map((r) => r.deduplicationKey.split(':')[1]),
    );
    const selectivities = allRecords.map((r) => r.features.selectivity);

    const bands = [
      { band: '0.0-0.3', min: 0, max: 0.3 },
      { band: '0.3-0.6', min: 0.3, max: 0.6 },
      { band: '0.6-0.8', min: 0.6, max: 0.8 },
      { band: '0.8-1.0', min: 0.8, max: 1.0 },
    ];

    const bandDistribution = bands.map((b) => {
      const indices = selectivities
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s >= b.min && s < b.max)
        .map(({ i }) => i);
      const bandAdmitted = indices.filter((i) => y[i] === 1).length;
      return {
        band: b.band,
        count: indices.length,
        admitRate: indices.length > 0 ? bandAdmitted / indices.length : 0,
      };
    });

    const nextTier = tier.tier < 4 ? [50, 200, 1000, 5000][tier.tier] : null;

    return {
      X,
      y,
      weights,
      featureNames,
      featureMedians: featureMedians as Record<string, number>,
      metadata: {
        totalSamples: allRecords.length,
        fromPredictions: predRecords.length,
        fromCases: caseRecords.length,
        admittedCount,
        rejectedCount: allRecords.length - admittedCount,
        admittedRatio:
          allRecords.length > 0 ? admittedCount / allRecords.length : 0,
        schoolCoverage: uniqueSchools.size,
        currentTier: tier.tier,
        nextTierThreshold: nextTier,
        bandDistribution,
        validation,
      },
    };
  }

  /**
   * Quick count without full data collection (for tier determination).
   */
  async countAvailableOutcomes(): Promise<number> {
    const [predictions, caseCount] = await Promise.all([
      this.prisma.predictionResult.findMany({
        where: {
          authority: 'AUTHORITATIVE',
          outcomeLabelRecords: {
            some: {
              status: { in: VERIFIED_OUTCOME_STATUSES },
              result: { in: ['ADMITTED', 'REJECTED'] },
            },
          },
        },
        select: {
          outcomeLabelRecords: {
            select: {
              result: true,
              status: true,
              isFinal: true,
              createdAt: true,
              resolvedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.admissionCase.count({
        where: { isVerified: true, ...CASE_REVIEW_APPROVED_WHERE },
      }),
    ]);
    const predCount = predictions.reduce((count, prediction) => {
      const canonical = resolveCanonicalPredictionOutcome(
        prediction.outcomeLabelRecords,
      );
      return count + (canonical.eligibleForCalibration ? 1 : 0);
    }, 0);
    return predCount + caseCount;
  }

  /**
   * Get dataset stats without full feature extraction (lightweight for dashboard).
   */
  async getDatasetStats(): Promise<Omit<DatasetStats, 'validation'>> {
    const count = await this.countAvailableOutcomes();
    const tier = determineTier(count);

    const [predictions, caseCount, admittedCase] = await Promise.all([
      this.prisma.predictionResult.findMany({
        where: {
          authority: 'AUTHORITATIVE',
          outcomeLabelRecords: {
            some: {
              status: { in: VERIFIED_OUTCOME_STATUSES },
              result: { in: ['ADMITTED', 'REJECTED'] },
            },
          },
        },
        select: {
          outcomeLabelRecords: {
            select: {
              result: true,
              status: true,
              isFinal: true,
              createdAt: true,
              resolvedAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.admissionCase.count({
        where: { isVerified: true, ...CASE_REVIEW_APPROVED_WHERE },
      }),
      this.prisma.admissionCase.count({
        where: {
          isVerified: true,
          ...CASE_REVIEW_APPROVED_WHERE,
          result: 'ADMITTED',
        },
      }),
    ]);

    const predictionSummary = predictions.reduce(
      (acc, prediction) => {
        const canonical = resolveCanonicalPredictionOutcome(
          prediction.outcomeLabelRecords,
        );
        if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
          return acc;
        }
        acc.total += 1;
        if (canonical.canonicalRecord.result === 'ADMITTED') {
          acc.admitted += 1;
        }
        return acc;
      },
      { total: 0, admitted: 0 },
    );

    const predCount = predictionSummary.total;
    const admittedPred = predictionSummary.admitted;
    const admittedTotal = admittedPred + admittedCase;
    const nextTier = tier.tier < 4 ? [50, 200, 1000, 5000][tier.tier] : null;

    return {
      totalSamples: count,
      fromPredictions: predCount,
      fromCases: caseCount,
      admittedCount: admittedTotal,
      rejectedCount: count - admittedTotal,
      admittedRatio: count > 0 ? admittedTotal / count : 0,
      schoolCoverage: 0, // Would require a distinct query
      currentTier: tier.tier,
      nextTierThreshold: nextTier,
      bandDistribution: [],
    };
  }

  // ============================================
  // Source 1: Prediction Outcomes
  // ============================================

  private async collectFromPredictions(): Promise<TrainingRecord[]> {
    const predictions = await this.prisma.predictionResult.findMany({
      where: {
        authority: 'AUTHORITATIVE',
        outcomeLabelRecords: {
          some: {
            status: { in: VERIFIED_OUTCOME_STATUSES },
            result: { in: ['ADMITTED', 'REJECTED'] },
          },
        },
      },
      select: {
        profileId: true,
        schoolId: true,
        probability: true,
        source: true,
        outcomeLabelRecords: {
          select: {
            result: true,
            status: true,
            isFinal: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (predictions.length === 0) return [];

    // Get profiles and schools in bulk
    const profileIds = [...new Set(predictions.map((p) => p.profileId))];
    const schoolIds = [...new Set(predictions.map((p) => p.schoolId))];

    const [profiles, schools] = await Promise.all([
      this.prisma.profile.findMany({
        where: { id: { in: profileIds } },
        include: {
          testScores: true,
          activities: true,
          awards: { include: { competition: true } },
        },
      }),
      this.prisma.school.findMany({
        where: { id: { in: schoolIds } },
      }),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const records: TrainingRecord[] = [];

    for (const pred of predictions) {
      const canonical = resolveCanonicalPredictionOutcome(
        pred.outcomeLabelRecords,
      );
      if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
        continue;
      }
      const profile = profileMap.get(pred.profileId);
      const school = schoolMap.get(pred.schoolId);
      if (!profile || !school) continue;

      try {
        const profileMetrics = this.profileToMetrics(profile);
        const schoolMetrics = this.schoolToMetrics(school);
        const features = extractFeatureVector(profileMetrics, schoolMetrics, {
          activityDetails: this.extractActivityDetails(profile),
          isPrivateSchool: (school as any).isPrivate,
          tuition: (school as any).tuition,
          usNewsRank: (school as any).usNewsRank,
        });

        records.push({
          features,
          label: canonical.canonicalRecord.result === 'ADMITTED' ? 1 : 0,
          weight: 1.0,
          source: 'prediction_outcome',
          deduplicationKey: `${pred.profileId}:${pred.schoolId}`,
        });
      } catch {
        // Skip malformed records
      }
    }

    return records;
  }

  // ============================================
  // Source 2: Admission Cases
  // ============================================

  private async collectFromCases(): Promise<TrainingRecord[]> {
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        isVerified: true,
        ...CASE_REVIEW_APPROVED_WHERE,
        result: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'] },
      },
      select: {
        id: true,
        userId: true,
        schoolId: true,
        result: true,
        gpaRange: true,
        satRange: true,
        actRange: true,
        toeflRange: true,
        tags: true,
        round: true,
        year: true,
        major: true,
        activityList: true,
        testScores: true,
        activities: true,
        awards: true,
        highSchoolType: true,
        curriculumType: true,
        demographicTags: true,
        apCount: true,
        apSubjects: true,
        ibScore: true,
        ibPredicted: true,
        financialAid: true,
        enrollmentStatus: true,
        narrative: true,
      },
    });

    if (cases.length === 0) return [];

    const schoolIds = [...new Set(cases.map((c) => c.schoolId))];
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s]));

    const records: TrainingRecord[] = [];

    for (const caseRecord of cases) {
      const school = schoolMap.get(caseRecord.schoolId);
      if (!school) continue;

      try {
        const schoolMetrics = this.schoolToMetrics(school);

        // Parse structured fields (prefer over legacy range/tag fallbacks)
        const testScores = parseCaseTestScores(caseRecord.testScores);
        const structuredActivities = parseCaseActivities(caseRecord.activities);
        const structuredAwards = parseCaseAwards(caseRecord.awards);

        const hasStructuredData =
          testScores.length > 0 ||
          structuredActivities.length > 0 ||
          structuredAwards.length > 0;

        let features: FeatureVector;
        let label: number;
        let weight: number;

        if (hasStructuredData) {
          // Build enriched ProfileMetrics from structured data with range fallbacks
          const satScore =
            testScores.find((t) => t.type === 'SAT')?.score ?? undefined;
          const actScore =
            testScores.find((t) => t.type === 'ACT')?.score ?? undefined;
          const toeflScore =
            testScores.find((t) => t.type === 'TOEFL')?.score ?? undefined;

          // Activity metrics from structured data, fallback to text or tags
          const activityCount =
            structuredActivities.length ||
            countActivitiesFromText(caseRecord.activityList) ||
            estimateActivityCountFromTags(caseRecord.tags);
          const leadershipCount = structuredActivities.filter((a) =>
            isLeadershipRole(a.role),
          ).length;
          const activityTierScore = structuredActivities.reduce(
            (sum, a) => sum + (a.tier ? (5 - a.tier) * 3 : 0),
            0,
          );

          // Award metrics from structured data, fallback to tags
          const awardCount =
            structuredAwards.length ||
            estimateAwardCountFromTags(caseRecord.tags);
          const hasNationalAward = structuredAwards.some(
            (a) => a.level === 'national' || a.level === 'international',
          );
          const hasIntlAward = structuredAwards.some(
            (a) => a.level === 'international',
          );

          const profile: ProfileMetrics = {
            gpa: caseRecord.gpaRange
              ? parseRangeMidpointLocal(caseRecord.gpaRange)
              : undefined,
            gpaScale: 4.0,
            satScore: satScore ?? parseRangeMidpointLocal(caseRecord.satRange),
            actScore: actScore ?? parseRangeMidpointLocal(caseRecord.actRange),
            toeflScore:
              toeflScore ?? parseRangeMidpointLocal(caseRecord.toeflRange),
            activityCount,
            awardCount,
            nationalAwardCount: hasNationalAward
              ? structuredAwards.filter(
                  (a) => a.level === 'national' || a.level === 'international',
                ).length
              : 0,
            internationalAwardCount: hasIntlAward
              ? structuredAwards.filter((a) => a.level === 'international')
                  .length
              : 0,
            awardTierScores: structuredAwards
              .filter((a) => a.tier)
              .map((a) => {
                const tierPoints: Record<number, number> = {
                  5: 25,
                  4: 15,
                  3: 8,
                  2: 4,
                  1: 2,
                };
                return tierPoints[a.tier!] ?? 0;
              }),
          };

          // Build activity details for feature extraction
          const activityDetails = structuredActivities.map((a) => ({
            category: a.category ?? 'other',
            role: a.role ?? '',
            totalHours: a.hoursPerWeek
              ? a.hoursPerWeek * (a.weeksPerYear ?? 40)
              : 0,
          }));

          features = extractFeatureVector(profile, schoolMetrics, {
            round: caseRecord.round ?? undefined,
            year: caseRecord.year ?? undefined,
            major: caseRecord.major ?? undefined,
            isPrivateSchool: (school as any).isPrivate,
            tuition: (school as any).tuition,
            usNewsRank: (school as any).usNewsRank,
            activityDetails:
              activityDetails.length > 0 ? activityDetails : undefined,
          });

          label = caseRecord.result === 'ADMITTED' ? 1 : 0;

          // Higher weight for structured data (more reliable)
          const completeness = [
            profile.gpa,
            profile.satScore,
            profile.actScore,
            profile.toeflScore,
          ].filter((v) => v != null).length;
          const structuredBonus =
            structuredActivities.length > 0 || structuredAwards.length > 0
              ? 0.2
              : 0;
          weight = Math.min(
            1.5,
            (completeness >= 2 ? 1.0 : 0.5) + structuredBonus,
          );
        } else {
          // Fallback: use legacy extractFeaturesFromCase (range + tag-based)
          const result = extractFeaturesFromCase(
            {
              gpaRange: caseRecord.gpaRange,
              satRange: caseRecord.satRange,
              actRange: caseRecord.actRange,
              toeflRange: caseRecord.toeflRange,
              tags: caseRecord.tags,
              result: caseRecord.result,
              round: caseRecord.round,
              year: caseRecord.year,
              major: caseRecord.major,
            },
            schoolMetrics,
            {
              isPrivate: (school as any).isPrivate,
              tuition: (school as any).tuition,
              usNewsRank: (school as any).usNewsRank,
            },
          );
          features = result.features;
          label = result.label;
          weight = result.weight;
        }

        records.push({
          features,
          label,
          weight,
          source: 'admission_case',
          deduplicationKey: `${caseRecord.userId}:${caseRecord.schoolId}`,
        });
      } catch {
        // Skip malformed records
      }
    }

    return records;
  }

  // ============================================
  // Mapping Helpers
  // ============================================

  private profileToMetrics(profile: any): ProfileMetrics {
    const testScores = profile.testScores ?? [];
    const sat = testScores.find((t: any) => t.testType === 'SAT');
    const act = testScores.find((t: any) => t.testType === 'ACT');
    const toefl = testScores.find((t: any) => t.testType === 'TOEFL');

    const activities = profile.activities ?? [];
    const awards = profile.awards ?? [];

    return {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      satScore: sat?.totalScore ?? undefined,
      actScore: act?.totalScore ?? undefined,
      toeflScore: toefl?.totalScore ?? undefined,
      activityCount: activities.length,
      awardCount: awards.length,
      nationalAwardCount: awards.filter((a: any) => a.level === 'NATIONAL')
        .length,
      internationalAwardCount: awards.filter(
        (a: any) => a.level === 'INTERNATIONAL',
      ).length,
      awardTierScores: awards
        .filter((a: any) => a.competition?.tier)
        .map((a: any) => {
          const tierPoints: Record<number, number> = {
            5: 25,
            4: 15,
            3: 8,
            2: 4,
            1: 2,
          };
          return tierPoints[a.competition.tier] ?? 0;
        }),
    };
  }

  private schoolToMetrics(school: any): SchoolMetrics {
    return {
      acceptanceRate: school.acceptanceRate
        ? Number(school.acceptanceRate)
        : undefined,
      satAvg: school.satAvg ?? undefined,
      sat25: school.sat25 ?? undefined,
      sat75: school.sat75 ?? undefined,
      actAvg: school.actAvg ?? undefined,
      act25: school.act25 ?? undefined,
      act75: school.act75 ?? undefined,
      usNewsRank: school.usNewsRank ?? undefined,
      graduationRate: school.graduationRate
        ? Number(school.graduationRate)
        : undefined,
    };
  }

  private extractActivityDetails(
    profile: any,
  ): FeatureExtractionOptions['activityDetails'] {
    const activities = profile.activities ?? [];
    return activities.map((a: any) => ({
      category: a.category ?? 'other',
      role: a.role ?? a.position ?? '',
      totalHours: a.hoursPerWeek
        ? a.hoursPerWeek * a.weeksPerYear * (a.yearsParticipated ?? 1)
        : 0,
    }));
  }
}

// ============================================
// Module-level helpers for structured data extraction
// ============================================

const LEADERSHIP_KEYWORDS = [
  'president',
  'captain',
  'founder',
  'editor-in-chief',
  'head',
  'director',
  'lead',
  'chair',
];

function isLeadershipRole(role?: string): boolean {
  if (!role) return false;
  const lower = role.toLowerCase();
  return LEADERSHIP_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * Parse a range string like "1500-1550" to its midpoint.
 * Local version for use within the training data service.
 */
function parseRangeMidpointLocal(range?: string | null): number | undefined {
  if (!range) return undefined;
  const match = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    return (parseFloat(match[1]) + parseFloat(match[2])) / 2;
  }
  const single = parseFloat(range);
  return isNaN(single) ? undefined : single;
}

/**
 * Count activities from a text list (one per line or semicolon-separated).
 */
function countActivitiesFromText(activityList?: string | null): number {
  if (!activityList) return 0;
  const lines = activityList
    .split(/[;\n]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.length;
}

/**
 * Estimate activity count from tags (legacy fallback).
 */
function estimateActivityCountFromTags(tags: string[]): number {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.includes('strong_activities') || lower.includes('strong_ec')) {
    return 8;
  }
  return 4; // Default assumption
}

/**
 * Estimate award count from tags (legacy fallback).
 */
function estimateAwardCountFromTags(tags: string[]): number {
  const lower = tags.map((t) => t.toLowerCase());
  const hasNational = lower.includes('national_award');
  const hasInternational = lower.includes('international_award');
  if (hasInternational) return 3;
  if (hasNational) return 2;
  return 0;
}
