#!/usr/bin/env tsx
import { Prisma, PrismaClient } from '@prisma/client';
import {
  activityBucket,
  apBucket,
  highSchoolTierBucket,
  ibBucket,
} from '../src/modules/prediction/distillation/teachers/case-aggregate-teacher-utils';
import {
  confidenceTier,
  wilsonInterval,
} from '../src/modules/prediction/utils/cohort-key';

const prisma = new PrismaClient();
const SET_VERSION =
  readArg('set-version') ??
  `case-aggregate-teachers-${new Date().toISOString().slice(0, 10)}`;

type TeacherKey =
  | 'ap-rigor-v1'
  | 'ib-v1'
  | 'feeder-hs-v1'
  | 'activity-intensity-v1';

type Bucket = {
  teacherKey: TeacherKey;
  schoolId: string;
  bucketKey: string;
  admits: number;
  rejects: number;
  caseIds: string[];
};

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function addBucket(
  buckets: Map<string, Bucket>,
  teacherKey: TeacherKey,
  schoolId: string,
  bucketKey: string,
  admitted: boolean,
  caseId: string,
) {
  const key = `${teacherKey}|${schoolId}|${bucketKey}`;
  const bucket = buckets.get(key) ?? {
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

function parseActivities(value: Prisma.JsonValue): Array<{
  role?: string;
  hoursPerWeek?: number;
  weeksPerYear?: number;
}> {
  return Array.isArray(value) ? (value as any[]) : [];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const minSamples = Number(readArg('min-samples') ?? 5);
  const cases = await prisma.admissionCase.findMany({
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

  const buckets = new Map<string, Bucket>();
  for (const admissionCase of cases) {
    const admitted = admissionCase.result === 'ADMITTED';

    const ap = apBucket(admissionCase.apCount);
    if (ap) {
      addBucket(
        buckets,
        'ap-rigor-v1',
        admissionCase.schoolId,
        ap,
        admitted,
        admissionCase.id,
      );
      addBucket(
        buckets,
        'ap-rigor-v1',
        admissionCase.schoolId,
        'ap:any',
        admitted,
        admissionCase.id,
      );
    }

    const ib = ibBucket(admissionCase.ibScore);
    if (ib || admissionCase.ibScore != null) {
      if (ib) {
        addBucket(
          buckets,
          'ib-v1',
          admissionCase.schoolId,
          ib,
          admitted,
          admissionCase.id,
        );
      }
      addBucket(
        buckets,
        'ib-v1',
        admissionCase.schoolId,
        'ib:any',
        admitted,
        admissionCase.id,
      );
    }

    const hs = highSchoolTierBucket(admissionCase.highSchool?.tier);
    if (hs) {
      addBucket(
        buckets,
        'feeder-hs-v1',
        admissionCase.schoolId,
        hs,
        admitted,
        admissionCase.id,
      );
      addBucket(
        buckets,
        'feeder-hs-v1',
        admissionCase.schoolId,
        'hs:any',
        admitted,
        admissionCase.id,
      );
    }

    const activity = activityBucket(parseActivities(admissionCase.activities));
    if (activity) {
      addBucket(
        buckets,
        'activity-intensity-v1',
        admissionCase.schoolId,
        activity,
        admitted,
        admissionCase.id,
      );
      addBucket(
        buckets,
        'activity-intensity-v1',
        admissionCase.schoolId,
        'activity:any',
        admitted,
        admissionCase.id,
      );
    }
  }

  const eligible = Array.from(buckets.values()).filter(
    (bucket) => bucket.admits + bucket.rejects >= minSamples,
  );
  console.log(
    JSON.stringify(
      {
        dryRun,
        setVersion: SET_VERSION,
        cases: cases.length,
        buckets: buckets.size,
        eligible: eligible.length,
        minSamples,
      },
      null,
      2,
    ),
  );

  if (dryRun) return;

  const sourceNames = [
    'distillation:ap-rigor-v1',
    'distillation:ib-v1',
    'distillation:feeder-hs-v1',
    'distillation:activity-intensity-v1',
  ];
  await prisma.predictionSourceObservation.deleteMany({
    where: { sourceName: { in: sourceNames }, sourceVersion: SET_VERSION },
  });

  await prisma.predictionSourceObservation.createMany({
    data: eligible.map((bucket) => {
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
        sourceVersion: SET_VERSION,
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
          setVersion: SET_VERSION,
          caseIds: bucket.caseIds.slice(0, 50),
          caseIdsTruncatedAt: bucket.caseIds.length > 50 ? 50 : null,
        } as Prisma.InputJsonValue,
      };
    }),
  });

  console.log(`Wrote ${eligible.length} aggregate observation rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
