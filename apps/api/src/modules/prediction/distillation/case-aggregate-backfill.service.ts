import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  activityBucket,
  apBucket,
  highSchoolTierBucket,
  ibBucket,
} from './teachers/case-aggregate-teacher-utils';
import { confidenceTier, wilsonInterval } from '../utils/cohort-key';

/**
 * Case-aggregate backfill service — admin-triggerable wrapper around the
 * script logic in `scripts/backfill-case-aggregate-teachers.ts`.
 *
 * What it does
 * ------------
 * Reads approved AdmissionCase rows → groups by (teacher, schoolId, bucket)
 * for the four case-driven teachers (ap-rigor-v1 / ib-v1 / feeder-hs-v1 /
 * activity-intensity-v1) → computes admit-rate + Wilson 95% CI per cell →
 * upserts to `PredictionSourceObservation` rows tagged with
 * `sourceName: 'distillation:<teacher-key>'` and a setVersion the teachers
 * read at evaluate-time.
 *
 * Why a separate service from the script
 * --------------------------------------
 * Cloud Run has no SSH/exec surface; running the script in prod requires
 * either a Cloud SQL proxy + local script run (creds-on-laptop) or a
 * Cloud Run Job (separate infra config). An admin endpoint sidesteps both
 * — same auth/throttle/audit story as PR-49 cohort-priors backfill.
 *
 * Idempotent: each run deletes prior rows with the same setVersion before
 * re-inserting, so re-running with the same setVersion is a clean replace.
 * Default setVersion encodes today's date so cron-style re-runs accumulate
 * versioned snapshots rather than overwriting.
 */

type TeacherKey =
  'ap-rigor-v1' | 'ib-v1' | 'feeder-hs-v1' | 'activity-intensity-v1';

type Bucket = {
  teacherKey: TeacherKey;
  schoolId: string;
  bucketKey: string;
  admits: number;
  rejects: number;
  caseIds: string[];
};

const TEACHER_SOURCE_NAMES = [
  'distillation:ap-rigor-v1',
  'distillation:ib-v1',
  'distillation:feeder-hs-v1',
  'distillation:activity-intensity-v1',
] as const;

@Injectable()
export class CaseAggregateBackfillService {
  private readonly logger = new Logger(CaseAggregateBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runBackfill(
    options: {
      dryRun?: boolean;
      minSamples?: number;
      setVersion?: string;
    } = {},
  ) {
    const dryRun = options.dryRun ?? true;
    const minSamples = options.minSamples ?? 5;
    const setVersion =
      options.setVersion ??
      `case-aggregate-teachers-${new Date().toISOString().slice(0, 10)}`;

    // governance: batch-operation — offline backfill over all approved cases
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
        result: { in: ['ADMITTED', 'REJECTED'] },
      },
      select: {
        id: true,
        schoolId: true,
        result: true,
        apCount: true,
        ibScore: true,
        activities: true,
        highSchool: { select: { tier: true } },
      },
    });

    const buckets = this.aggregateBuckets(cases);
    const eligible = Array.from(buckets.values()).filter(
      (bucket) => bucket.admits + bucket.rejects >= minSamples,
    );
    const droppedLowSample = buckets.size - eligible.length;

    // Per-teacher tally so the operator can see at a glance whether each
    // teacher actually has eligible coverage. A teacher with 0 eligible
    // cells is a strong signal that the underlying field (apCount, ibScore,
    // highSchool.tier, activities[]) is sparse in the case pool.
    const eligibleByTeacher: Record<string, number> = {
      'ap-rigor-v1': 0,
      'ib-v1': 0,
      'feeder-hs-v1': 0,
      'activity-intensity-v1': 0,
    };
    for (const bucket of eligible) {
      eligibleByTeacher[bucket.teacherKey] =
        (eligibleByTeacher[bucket.teacherKey] ?? 0) + 1;
    }

    const previewRows = eligible.slice(0, 20).map((bucket) => {
      const total = bucket.admits + bucket.rejects;
      const rate = bucket.admits / total;
      const { lower, upper } = wilsonInterval(bucket.admits, total);
      return {
        teacherKey: bucket.teacherKey,
        schoolId: bucket.schoolId,
        bucketKey: bucket.bucketKey,
        sampleCount: total,
        admitRate: rate,
        ciLower: lower,
        ciUpper: upper,
        confidence: confidenceTier(total),
      };
    });

    if (dryRun) {
      return {
        dryRun: true,
        scanned: cases.length,
        bucketsTotal: buckets.size,
        eligibleBuckets: eligible.length,
        eligibleByTeacher,
        droppedLowSample,
        written: 0,
        deleted: 0,
        setVersion,
        minSamples,
        preview: previewRows,
        generatedAt: new Date().toISOString(),
      };
    }

    // Idempotent replace: drop prior rows for this setVersion before
    // inserting fresh ones. Scoped to our 4 teacher sourceNames so this
    // never touches rows owned by other distillation pipelines.
    // governance: batch-operation — offline backfill over all approved cases
    const deleted = await this.prisma.predictionSourceObservation.deleteMany({
      where: {
        sourceName: { in: TEACHER_SOURCE_NAMES as unknown as string[] },
        sourceVersion: setVersion,
      },
    });

    let written = 0;
    if (eligible.length > 0) {
      // Chunk to keep the createMany payload bounded on Cloud SQL.
      const CHUNK = 500;
      for (let i = 0; i < eligible.length; i += CHUNK) {
        const chunk = eligible.slice(i, i + CHUNK);
        await this.prisma.predictionSourceObservation.createMany({
          data: chunk.map((bucket) =>
            this.bucketToObservation(bucket, setVersion),
          ),
        });
        written += chunk.length;
      }
    }

    this.logger.log(
      `Case-aggregate backfill: deleted=${deleted.count}, written=${written}, setVersion=${setVersion}`,
    );

    return {
      dryRun: false,
      scanned: cases.length,
      bucketsTotal: buckets.size,
      eligibleBuckets: eligible.length,
      eligibleByTeacher,
      droppedLowSample,
      written,
      deleted: deleted.count,
      setVersion,
      minSamples,
      preview: previewRows,
      generatedAt: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------

  private aggregateBuckets(
    cases: Array<{
      id: string;
      schoolId: string;
      result: string;
      apCount: number | null;
      ibScore: number | null;
      activities: Prisma.JsonValue;
      highSchool: { tier: number | null } | null;
    }>,
  ): Map<string, Bucket> {
    const buckets = new Map<string, Bucket>();

    for (const c of cases) {
      const admitted = c.result === 'ADMITTED';

      const ap = apBucket(c.apCount);
      if (ap) {
        this.addBucket(buckets, 'ap-rigor-v1', c.schoolId, ap, admitted, c.id);
        this.addBucket(
          buckets,
          'ap-rigor-v1',
          c.schoolId,
          'ap:any',
          admitted,
          c.id,
        );
      }

      const ib = ibBucket(c.ibScore);
      if (ib || c.ibScore != null) {
        if (ib) {
          this.addBucket(buckets, 'ib-v1', c.schoolId, ib, admitted, c.id);
        }
        this.addBucket(buckets, 'ib-v1', c.schoolId, 'ib:any', admitted, c.id);
      }

      const hs = highSchoolTierBucket(c.highSchool?.tier);
      if (hs) {
        this.addBucket(buckets, 'feeder-hs-v1', c.schoolId, hs, admitted, c.id);
        this.addBucket(
          buckets,
          'feeder-hs-v1',
          c.schoolId,
          'hs:any',
          admitted,
          c.id,
        );
      }

      const activity = activityBucket(this.parseActivities(c.activities));
      if (activity) {
        this.addBucket(
          buckets,
          'activity-intensity-v1',
          c.schoolId,
          activity,
          admitted,
          c.id,
        );
        this.addBucket(
          buckets,
          'activity-intensity-v1',
          c.schoolId,
          'activity:any',
          admitted,
          c.id,
        );
      }
    }

    return buckets;
  }

  private addBucket(
    buckets: Map<string, Bucket>,
    teacherKey: TeacherKey,
    schoolId: string,
    bucketKey: string,
    admitted: boolean,
    caseId: string,
  ) {
    const key = `${teacherKey}|${schoolId}|${bucketKey}`;
    const bucket: Bucket = buckets.get(key) ?? {
      teacherKey,
      schoolId,
      bucketKey,
      admits: 0,
      rejects: 0,
      caseIds: [],
    };
    if (admitted) bucket.admits += 1;
    else bucket.rejects += 1;
    bucket.caseIds.push(caseId);
    buckets.set(key, bucket);
  }

  private parseActivities(value: Prisma.JsonValue): Array<{
    role?: string;
    hoursPerWeek?: number;
    weeksPerYear?: number;
  }> {
    return Array.isArray(value)
      ? (value as Array<{
          role?: string;
          hoursPerWeek?: number;
          weeksPerYear?: number;
        }>)
      : [];
  }

  private bucketToObservation(
    bucket: Bucket,
    setVersion: string,
  ): Prisma.PredictionSourceObservationCreateManyInput {
    const total = bucket.admits + bucket.rejects;
    const rate = bucket.admits / total;
    const { lower, upper } = wilsonInterval(bucket.admits, total);
    return {
      schoolId: bucket.schoolId,
      metricType: 'distillation_case_aggregate',
      rate: new Prisma.Decimal(rate),
      observedProbability: new Prisma.Decimal(rate),
      observedProbabilityLow: new Prisma.Decimal(lower),
      observedProbabilityHigh: new Prisma.Decimal(upper),
      sourceType: 'INTERNAL_CASES' as const,
      sourceName: `distillation:${bucket.teacherKey}`,
      sourceVersion: setVersion,
      status: 'APPROVED_FOR_SIGNAL' as const,
      observationStage: 'DISTILLATION_AGGREGATE',
      confidenceLabel: confidenceTier(total),
      sampleCount: total,
      metadata: {
        teacherKey: bucket.teacherKey,
        bucketKey: bucket.bucketKey,
        admits: bucket.admits,
        rejects: bucket.rejects,
        lowerBound: lower,
        upperBound: upper,
        setVersion,
        // Cap the caseIds list to keep the JSON bounded — same convention
        // as cohort-priors backfill (PR-49).
        caseIds: bucket.caseIds.slice(0, 50),
        caseIdsTruncatedAt: bucket.caseIds.length > 50 ? 50 : null,
      },
    };
  }
}
