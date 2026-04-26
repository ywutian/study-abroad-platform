import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import {
  activityBucket,
  readCaseAggregateSignal,
} from './case-aggregate-teacher-utils';
import { inactiveSignal } from './teacher-utils';

const DEFAULT_WEIGHT = 0.06;

@Injectable()
export class ActivityIntensityTeacherService implements TeacherSignalProvider {
  readonly key = 'activity-intensity-v1' as const;
  readonly label = 'Activity Intensity Case Aggregate';
  readonly sourceType = 'INTERNAL_CASES' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const bucketKey = activityBucket(input.profile.activities ?? []);
    if (!bucketKey) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_activities',
      ]);
    }

    return readCaseAggregateSignal({
      prisma: this.prisma,
      key: this.key,
      label: this.label,
      schoolId: input.schoolId,
      bucketKey,
      fallbackBucketKey: 'activity:any',
    });
  }
}
