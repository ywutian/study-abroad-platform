import { PrismaService } from '../../../../prisma/prisma.service';
import type { DistillationTeacherSignal } from '../types';
import {
  confidenceFromSampleCount,
  inactiveSignal,
  resolveObservedProbability,
} from './teacher-utils';

type AggregateTeacherKey = Extract<
  DistillationTeacherSignal['key'],
  'ap-rigor-v1' | 'ib-v1' | 'feeder-hs-v1' | 'activity-intensity-v1'
>;

export async function readCaseAggregateSignal(params: {
  prisma: PrismaService;
  key: AggregateTeacherKey;
  label: string;
  schoolId: string;
  bucketKey: string | null;
  fallbackBucketKey: string;
}): Promise<
  Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
> {
  const { prisma, key, label, schoolId, bucketKey, fallbackBucketKey } = params;
  const bucketKeys = [bucketKey, fallbackBucketKey].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidateBucket of bucketKeys) {
    const row = await prisma.predictionSourceObservation.findFirst({
      where: {
        schoolId,
        sourceName: `distillation:${key}`,
        metricType: 'distillation_case_aggregate',
        status: 'APPROVED_FOR_SIGNAL',
        metadata: { path: ['bucketKey'], equals: candidateBucket },
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const probability = row ? resolveObservedProbability(row) : null;
    if (row && probability != null) {
      return {
        key,
        label,
        sourceName:
          `distillation:${key}` as DistillationTeacherSignal['sourceName'],
        sourceType: 'INTERNAL_CASES',
        probability,
        active: true,
        confidence:
          (row.confidenceLabel as 'low' | 'medium' | 'high' | null) ??
          confidenceFromSampleCount(row.sampleCount, 'low'),
        sampleCount: row.sampleCount ?? undefined,
        bucketKey: candidateBucket,
        missingReasons: [],
        metadata: {
          matchedBucketKey: candidateBucket,
          fallback: candidateBucket !== bucketKey,
          sourceVersion: row.sourceVersion,
          aggregateMetadata: row.metadata,
        },
      };
    }
  }

  return inactiveSignal(key, label, 'INTERNAL_CASES', [
    'missing_case_aggregate',
  ]);
}

export function countApScores(testScores: Array<{ type: string }>): number {
  return (testScores ?? []).filter((score) =>
    /(^|\b)AP(\b|_)/i.test(score.type),
  ).length;
}

export function apBucket(apCount: number | null | undefined): string | null {
  if (apCount == null || !Number.isFinite(apCount)) return null;
  if (apCount >= 7) return 'ap:7_plus';
  if (apCount >= 4) return 'ap:4_6';
  return 'ap:0_3';
}

export function ibBucket(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 40) return 'ib:40_plus';
  if (score >= 35) return 'ib:35_39';
  return 'ib:below_35';
}

export function highSchoolTierBucket(
  tier: number | null | undefined,
): string | null {
  if (tier == null || !Number.isFinite(tier)) return null;
  return `hs:tier_${Math.max(1, Math.min(5, Math.round(tier)))}`;
}

export function activityBucket(
  activities: Array<{
    role?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
  }>,
): string | null {
  if (!activities || activities.length === 0) return null;
  let leadershipCount = 0;
  let totalHours = 0;
  for (const activity of activities) {
    const role = activity.role?.toLowerCase() ?? '';
    if (/(founder|president|captain|leader|head|chair|director)/.test(role)) {
      leadershipCount += 1;
    }
    const hoursPerWeek = Number(activity.hoursPerWeek ?? 0);
    const weeksPerYear = Number(activity.weeksPerYear ?? 0);
    if (Number.isFinite(hoursPerWeek) && Number.isFinite(weeksPerYear)) {
      totalHours += hoursPerWeek * weeksPerYear;
    }
  }

  if (leadershipCount >= 2 || totalHours >= 800) return 'activity:high';
  if (leadershipCount >= 1 || totalHours >= 300) return 'activity:medium';
  return 'activity:low';
}
