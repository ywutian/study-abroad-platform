/**
 * Training Data Service
 *
 * Collects and prepares training data from two sources:
 * 1. PredictionResult records with actualResult (user-reported outcomes)
 * 2. AdmissionCase records (admin-imported + user-submitted, verified)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
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
    const [predCount, caseCount] = await Promise.all([
      this.prisma.predictionResult.count({
        where: { actualResult: { not: null } },
      }),
      this.prisma.admissionCase.count({
        where: { isVerified: true },
      }),
    ]);
    return predCount + caseCount;
  }

  /**
   * Get dataset stats without full feature extraction (lightweight for dashboard).
   */
  async getDatasetStats(): Promise<Omit<DatasetStats, 'validation'>> {
    const count = await this.countAvailableOutcomes();
    const tier = determineTier(count);

    const [predCount, caseCount, admittedPred, admittedCase] =
      await Promise.all([
        this.prisma.predictionResult.count({
          where: { actualResult: { not: null } },
        }),
        this.prisma.admissionCase.count({ where: { isVerified: true } }),
        this.prisma.predictionResult.count({
          where: { actualResult: 'ADMITTED' },
        }),
        this.prisma.admissionCase.count({
          where: { isVerified: true, result: 'ADMITTED' },
        }),
      ]);

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
        actualResult: { in: ['ADMITTED', 'REJECTED', 'WAITLISTED'] },
      },
      select: {
        profileId: true,
        schoolId: true,
        actualResult: true,
        probability: true,
        source: true,
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
          label: pred.actualResult === 'ADMITTED' ? 1 : 0,
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
        const { features, label, weight } = extractFeaturesFromCase(
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
