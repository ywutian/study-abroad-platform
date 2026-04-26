import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import { inactiveSignal, normalizeToken, toProbability } from './teacher-utils';

const DEFAULT_WEIGHT = 0.12;
const US_COUNTRY_TOKENS = new Set(['US', 'USA', 'UNITED STATES']);

@Injectable()
export class GeoCohortTeacherService implements TeacherSignalProvider {
  readonly key = 'geo-cohort-v1' as const;
  readonly label = 'Residency Cohort Admit Rate';
  readonly sourceType = 'OFFICIAL_SCHOOL' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { state: true, isPrivate: true },
    });
    if (!school?.state || school.isPrivate) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'school_not_public_with_state',
      ]);
    }

    const applicantLocation = normalizeToken(input.profile.highSchoolLocation);
    if (!applicantLocation || US_COUNTRY_TOKENS.has(applicantLocation)) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_applicant_state',
      ]);
    }

    const schoolState = normalizeToken(school.state);
    const isInState = applicantLocation === schoolState;
    const metricKey = isInState
      ? 'in_state_acceptance_rate'
      : 'out_of_state_acceptance_rate';

    const metric = await this.prisma.schoolMetric.findFirst({
      where: { schoolId: input.schoolId, metricKey },
      orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
    });
    const probability = metric ? toProbability(metric.value.toNumber()) : null;
    if (!metric || probability == null) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_residency_acceptance_rate',
      ]);
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:geo-cohort-v1',
      sourceType: this.sourceType,
      probability,
      active: true,
      confidence: 'high',
      bucketKey: isInState ? 'in_state' : 'out_of_state',
      missingReasons: [],
      metadata: {
        applicantState: applicantLocation,
        schoolState,
        metricKey,
        metricYear: metric.year,
      },
    };
  }
}
