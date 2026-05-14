import { Injectable } from '@nestjs/common';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import { inactiveSignal, toProbability } from './teacher-utils';

const DEFAULT_WEIGHT = 0.15;

@Injectable()
export class IntlPoolTeacherService implements TeacherSignalProvider {
  readonly key = 'intl-pool-v1' as const;
  readonly label = 'International Admit Pool';
  readonly sourceType = 'OFFICIAL_SCHOOL' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    if (!input.profile.isInternational) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'not_international_applicant',
      ]);
    }

    const probability = toProbability(input.school.intlAcceptanceRate);
    if (probability == null) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_international_acceptance_rate',
      ]);
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:intl-pool-v1',
      sourceType: this.sourceType,
      probability,
      active: true,
      confidence: 'high',
      bucketKey: 'international',
      missingReasons: [],
      metadata: {
        intlAcceptanceRate: probability,
        intlStudentPct: input.school.intlStudentPct ?? null,
        // Preserve null (unreviewed) so downstream consumers and shadow
        // comparisons can distinguish un-reviewed from verified need-aware.
        needBlindInternational: input.school.needBlindInternational ?? null,
        nationality: input.profile.nationality ?? null,
        needsFinancialAid: input.profile.needsFinancialAid ?? null,
      },
    };
  }
}
