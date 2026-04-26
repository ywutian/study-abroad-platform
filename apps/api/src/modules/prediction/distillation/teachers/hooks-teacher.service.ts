import { Injectable } from '@nestjs/common';
import { PredictionHookModifiersService } from '../../prediction-hook-modifiers.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import { inactiveSignal } from './teacher-utils';

const DEFAULT_WEIGHT = 0.1;

@Injectable()
export class HooksTeacherService implements TeacherSignalProvider {
  readonly key = 'hooks-v1' as const;
  readonly label = 'Applicant Hook Adjustments';
  readonly sourceType = 'MANUAL_RESEARCH' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly hookModifiers: PredictionHookModifiersService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const shifts = this.hookModifiers
      .computeHookShifts(input.profile, input.school)
      .filter((shift) => shift.hookType !== 'ROUND_BONUS');

    if (shifts.length === 0) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'no_applicable_hooks',
      ]);
    }

    const probability = this.hookModifiers.applyHooks(
      input.ourProbPrePlatt,
      shifts,
    );
    const hasHighImpactShift = shifts.some(
      (shift) => Math.abs(shift.logOddsShift) >= 1,
    );

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:hooks-v1',
      sourceType: this.sourceType,
      probability,
      active: true,
      confidence: hasHighImpactShift ? 'high' : 'medium',
      sampleCount: shifts.length,
      bucketKey: shifts
        .map((shift) => shift.hookType)
        .sort()
        .join('|'),
      missingReasons: [],
      metadata: {
        shifts,
        baseProbability: input.ourProbPrePlatt,
        totalLogOddsShift: shifts.reduce(
          (sum, shift) => sum + shift.logOddsShift,
          0,
        ),
      },
    };
  }
}
