import { Injectable } from '@nestjs/common';
import { resolveMajorToCip } from '@study-abroad/shared/scoring';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import {
  clampProbability,
  inactiveSignal,
  toProbability,
} from './teacher-utils';

const DEFAULT_WEIGHT = 0.1;

const COMPETITIVENESS_MULTIPLIERS: Record<number, number> = {
  5: 0.65,
  4: 0.8,
  3: 1,
  2: 1.1,
  1: 1.2,
};

@Injectable()
export class MajorSelectivityTeacherService implements TeacherSignalProvider {
  readonly key = 'major-selectivity-v1' as const;
  readonly label = 'Program Selectivity';
  readonly sourceType = 'MANUAL_RESEARCH' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const targetMajor = input.profile.targetMajor?.trim();
    if (!targetMajor) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_target_major',
      ]);
    }

    const cipCode = resolveMajorToCip(targetMajor);
    // governance: system-scope — SchoolProgram — published programme data
    const program = await this.prisma.schoolProgram.findFirst({
      where: {
        schoolId: input.schoolId,
        ...(cipCode
          ? { cipCode }
          : { programName: { contains: targetMajor, mode: 'insensitive' } }),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    if (!program) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_school_program',
      ]);
    }

    const explicitRate = program.acceptanceRateEstimate
      ? toProbability(program.acceptanceRateEstimate.toNumber())
      : null;
    const schoolBaseRate = toProbability(input.school.acceptanceRate);
    const multiplier =
      COMPETITIVENESS_MULTIPLIERS[program.competitiveness] ?? 1;
    const probability =
      explicitRate ??
      (schoolBaseRate != null
        ? clampProbability(schoolBaseRate * multiplier)
        : null);

    if (probability == null) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_program_rate_and_school_rate',
      ]);
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:major-selectivity-v1',
      sourceType: this.sourceType,
      probability,
      active: true,
      confidence: explicitRate != null ? 'medium' : 'low',
      bucketKey: `cip:${program.cipCode}`,
      missingReasons: [],
      metadata: {
        targetMajor,
        matchedProgram: program.programName,
        cipCode: program.cipCode,
        competitiveness: program.competitiveness,
        acceptanceRateEstimate: explicitRate,
        multiplier,
        usedExplicitRate: explicitRate != null,
      },
    };
  }
}
