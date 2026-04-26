import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import {
  highSchoolTierBucket,
  readCaseAggregateSignal,
} from './case-aggregate-teacher-utils';
import { inactiveSignal } from './teacher-utils';

const DEFAULT_WEIGHT = 0.08;

@Injectable()
export class FeederHsTeacherService implements TeacherSignalProvider {
  readonly key = 'feeder-hs-v1' as const;
  readonly label = 'High School Feeder Aggregate';
  readonly sourceType = 'INTERNAL_CASES' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const bucketKey = highSchoolTierBucket(input.profile.highSchoolTier);
    if (!bucketKey) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_high_school_tier',
      ]);
    }

    return readCaseAggregateSignal({
      prisma: this.prisma,
      key: this.key,
      label: this.label,
      schoolId: input.schoolId,
      bucketKey,
      fallbackBucketKey: 'hs:any',
    });
  }
}
