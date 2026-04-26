import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import {
  apBucket,
  countApScores,
  readCaseAggregateSignal,
} from './case-aggregate-teacher-utils';
import { inactiveSignal } from './teacher-utils';

const DEFAULT_WEIGHT = 0.08;

@Injectable()
export class ApRigorTeacherService implements TeacherSignalProvider {
  readonly key = 'ap-rigor-v1' as const;
  readonly label = 'AP Rigor Case Aggregate';
  readonly sourceType = 'INTERNAL_CASES' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const apCount = countApScores(input.profile.testScores ?? []);
    const bucketKey = apBucket(apCount > 0 ? apCount : null);
    if (!bucketKey) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_ap_count',
      ]);
    }

    return readCaseAggregateSignal({
      prisma: this.prisma,
      key: this.key,
      label: this.label,
      schoolId: input.schoolId,
      bucketKey,
      fallbackBucketKey: 'ap:any',
    });
  }
}
