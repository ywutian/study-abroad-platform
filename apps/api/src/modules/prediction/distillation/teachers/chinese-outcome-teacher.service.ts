import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';

const DEFAULT_WEIGHT = 0.08;

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

type OutcomeBucket = {
  key: string;
  where: Record<string, any>;
};

@Injectable()
export class ChineseOutcomeTeacherService implements TeacherSignalProvider {
  readonly key = 'cn-outcome-v1' as const;
  readonly label = 'Chinese Outcome Teacher';
  readonly sourceType = 'INTERNAL_OUTCOMES' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    if (!input.cohortKey.startsWith('CN__')) {
      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:cn-outcome-v1',
        sourceType: this.sourceType,
        probability: null,
        active: false,
        confidence: 'low',
        missingReasons: ['non_china_cohort'],
      };
    }

    const buckets = this.buildBuckets(input);
    for (const bucket of buckets) {
      const grouped = await this.prisma.predictionSnapshot.groupBy({
        by: ['outcomeLabel'],
        where: {
          // Only count real predictions — PREVIEW rows (school-list quick-match)
          // must never inform teacher-signal statistics.
          authority: 'AUTHORITATIVE',
          outcomeLabel: {
            in: ['ADMITTED', 'REJECTED', 'WAITLISTED'],
          },
          ...bucket.where,
        },
        _count: true,
      });

      const total = grouped.reduce((sum: number, row) => sum + row._count, 0);
      if (total < 20) continue;

      const admitted =
        grouped.find((row) => row.outcomeLabel === 'ADMITTED')?._count ?? 0;
      const confidence = total >= 50 ? 'high' : 'medium';

      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:cn-outcome-v1',
        sourceType: this.sourceType,
        probability: clampProbability(admitted / total),
        active: true,
        confidence,
        sampleCount: total,
        bucketKey: bucket.key,
        missingReasons: [],
        metadata: {
          admitted,
          total,
          bucketKey: bucket.key,
        },
      };
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:cn-outcome-v1',
      sourceType: this.sourceType,
      probability: null,
      active: false,
      confidence: 'low',
      missingReasons: ['insufficient_cn_outcomes'],
    };
  }

  private buildBuckets(input: DistillationEvaluationInput): OutcomeBucket[] {
    const round = input.applicationRound || undefined;
    const band = input.selectivityBand || undefined;

    const buckets: OutcomeBucket[] = [];
    if (round) {
      buckets.push({
        key: 'school:cohort:round',
        where: {
          schoolId: input.schoolId,
          cohortKey: input.cohortKey,
          applicationRound: round,
        },
      });
    }
    buckets.push({
      key: 'school:cohort',
      where: {
        schoolId: input.schoolId,
        cohortKey: input.cohortKey,
      },
    });
    if (band && round) {
      buckets.push({
        key: 'band:cohort:round',
        where: {
          selectivityBand: band,
          cohortKey: input.cohortKey,
          applicationRound: round,
        },
      });
    }
    if (band) {
      buckets.push({
        key: 'band:cohort',
        where: {
          selectivityBand: band,
          cohortKey: input.cohortKey,
        },
      });
    }
    buckets.push({
      key: 'cohort',
      where: {
        cohortKey: input.cohortKey,
      },
    });

    return buckets;
  }
}
