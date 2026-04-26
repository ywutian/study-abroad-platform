import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import {
  ibBucket,
  readCaseAggregateSignal,
} from './case-aggregate-teacher-utils';
import { inactiveSignal } from './teacher-utils';

const DEFAULT_WEIGHT = 0.08;

@Injectable()
export class IbTeacherService implements TeacherSignalProvider {
  readonly key = 'ib-v1' as const;
  readonly label = 'IB Curriculum Case Aggregate';
  readonly sourceType = 'INTERNAL_CASES' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const isIb = input.profile.educationSystem?.toUpperCase() === 'IB';
    const ibScore =
      input.profile.testScores
        ?.filter((score) => score.type.toUpperCase().includes('IB'))
        .map((score) => score.score)
        .find((score) => Number.isFinite(score)) ?? null;

    if (!isIb && ibScore == null) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'not_ib_profile',
      ]);
    }

    return readCaseAggregateSignal({
      prisma: this.prisma,
      key: this.key,
      label: this.label,
      schoolId: input.schoolId,
      bucketKey: ibBucket(ibScore),
      fallbackBucketKey: 'ib:any',
    });
  }
}
