import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import { inactiveSignal, normalizeToken, toProbability } from './teacher-utils';

const DEFAULT_WEIGHT = 0.15;

const ROUND_METRICS: Record<string, string[]> = {
  ED: ['ed_acceptance_rate'],
  ED2: ['ed2_acceptance_rate', 'ed_acceptance_rate'],
  REA: ['rea_acceptance_rate'],
  SCEA: ['scea_acceptance_rate', 'rea_acceptance_rate'],
  EA: ['ea_acceptance_rate'],
};

@Injectable()
export class EdBoostTeacherService implements TeacherSignalProvider {
  readonly key = 'ed-boost-v1' as const;
  readonly label = 'Early Round Admit Rate';
  readonly sourceType = 'OFFICIAL_SCHOOL' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const round = normalizeToken(input.applicationRound);
    const metricKeys = round ? ROUND_METRICS[round] : undefined;
    if (!round || !metricKeys) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'round_not_early',
      ]);
    }
    if (
      (round === 'ED' || round === 'ED2') &&
      input.school.hasEarlyDecision === false
    ) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'school_has_no_early_decision',
      ]);
    }

    // governance: system-scope — SchoolMetric — published institution data
    const metric = await this.prisma.schoolMetric.findFirst({
      where: {
        schoolId: input.schoolId,
        metricKey: { in: metricKeys },
      },
      orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
    });
    const probability = metric ? toProbability(metric.value.toNumber()) : null;
    if (!metric || probability == null) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_round_acceptance_rate',
      ]);
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:ed-boost-v1',
      sourceType: this.sourceType,
      probability,
      active: true,
      confidence: 'high',
      bucketKey: `${round}:${metric.metricKey}`,
      missingReasons: [],
      metadata: {
        round,
        metricKey: metric.metricKey,
        metricYear: metric.year,
      },
    };
  }
}
