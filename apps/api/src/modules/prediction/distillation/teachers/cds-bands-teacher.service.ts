import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import {
  confidenceFromSampleCount,
  inactiveSignal,
  toProbability,
} from './teacher-utils';

const DEFAULT_WEIGHT = 0.25;

function resolveGpaBand(gpaNormalized: number | null): string | null {
  if (gpaNormalized == null || !Number.isFinite(gpaNormalized)) return null;
  const gpa4 = gpaNormalized <= 1 ? gpaNormalized * 4 : gpaNormalized;
  if (gpa4 >= 3.75) return '3.75-4.00';
  if (gpa4 >= 3.5) return '3.50-3.74';
  if (gpa4 >= 3.25) return '3.25-3.49';
  if (gpa4 >= 3) return '3.00-3.24';
  return '<3.00';
}

function resolveSatBand(sat: number | null): string | null {
  if (sat == null || !Number.isFinite(sat)) return null;
  if (sat >= 1500) return '1500-1600';
  if (sat >= 1400) return '1400-1499';
  if (sat >= 1300) return '1300-1399';
  return '<1300';
}

function resolveActBand(act: number | null): string | null {
  if (act == null || !Number.isFinite(act)) return null;
  if (act >= 34) return '34-36';
  if (act >= 31) return '31-33';
  if (act >= 28) return '28-30';
  return '<28';
}

@Injectable()
export class CdsBandsTeacherService implements TeacherSignalProvider {
  readonly key = 'cds-bands-v1' as const;
  readonly label = 'CDS Admit Band';
  readonly sourceType = 'OFFICIAL_SCHOOL' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const gpaBand = resolveGpaBand(input.inputSummary.gpaNormalized);
    if (!gpaBand) {
      return inactiveSignal(this.key, this.label, this.sourceType, [
        'missing_gpa',
      ]);
    }

    const candidates: Array<{ testType: string; testBand: string }> = [];
    const satBand = resolveSatBand(input.inputSummary.sat);
    if (satBand) candidates.push({ testType: 'SAT', testBand: satBand });
    const actBand = resolveActBand(input.inputSummary.act);
    if (actBand) candidates.push({ testType: 'ACT', testBand: actBand });
    candidates.push({ testType: 'GPA_ONLY', testBand: 'ANY' });

    for (const candidate of candidates) {
      // governance: system-scope — SchoolCdsAdmitBand — published Common Data Set figures
      const row = await this.prisma.schoolCdsAdmitBand.findFirst({
        where: {
          schoolId: input.schoolId,
          gpaBand,
          testType: candidate.testType,
          testBand: candidate.testBand,
        },
        orderBy: [{ cycleYear: 'desc' }, { updatedAt: 'desc' }],
      });

      const probability = row ? toProbability(row.admitRate.toNumber()) : null;
      if (row && probability != null) {
        return {
          key: this.key,
          label: this.label,
          sourceName: 'distillation:cds-bands-v1',
          sourceType: this.sourceType,
          probability,
          active: true,
          confidence: confidenceFromSampleCount(row.sampleCount, 'high'),
          sampleCount: row.sampleCount ?? undefined,
          bucketKey: `${gpaBand}|${candidate.testType}:${candidate.testBand}`,
          missingReasons: [],
          metadata: {
            gpaBand,
            testType: candidate.testType,
            testBand: candidate.testBand,
            cycleYear: row.cycleYear,
            source: row.source,
            sourceUrl: row.sourceUrl,
            fallback: candidate.testType === 'GPA_ONLY',
          },
        };
      }
    }

    return inactiveSignal(this.key, this.label, this.sourceType, [
      'no_cds_band_match',
    ]);
  }
}
