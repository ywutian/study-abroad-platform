import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';

const DEFAULT_WEIGHT = 0.03;

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    const x = index - xMean;
    numerator += x * (values[index] - yMean);
    denominator += x * x;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

@Injectable()
export class IpedsTrendTeacherService implements TeacherSignalProvider {
  readonly key = 'ipeds-trend-v1' as const;
  readonly label = 'IPEDS Trend Prior';
  readonly sourceType = 'OFFICIAL_FEDERAL' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const metrics = await this.prisma.schoolMetric.findMany({
      where: {
        schoolId: input.schoolId,
        metricKey: { in: ['applications', 'admissions'] },
      },
      select: {
        year: true,
        metricKey: true,
        value: true,
      },
      orderBy: { year: 'desc' },
    });

    const yearly = new Map<
      number,
      { applications?: number; admissions?: number }
    >();
    for (const metric of metrics) {
      const current = yearly.get(metric.year) ?? {};
      current[metric.metricKey as 'applications' | 'admissions'] = Number(
        metric.value,
      );
      yearly.set(metric.year, current);
    }

    const rates = Array.from(yearly.entries())
      .filter(
        ([, row]) =>
          typeof row.applications === 'number' &&
          typeof row.admissions === 'number' &&
          row.applications > 0 &&
          row.admissions >= 0,
      )
      .sort(([a], [b]) => a - b)
      .slice(-5)
      .map(([year, row]) => ({
        year,
        rate: row.admissions! / row.applications!,
      }));

    if (rates.length < 3) {
      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:ipeds-trend-v1',
        sourceType: this.sourceType,
        probability: null,
        active: false,
        confidence: 'low',
        missingReasons: ['insufficient_ipeds_history'],
      };
    }

    const slope = linearSlope(rates.map((item) => item.rate));
    const trendAdjustment = Math.max(-0.03, Math.min(0.03, slope));

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:ipeds-trend-v1',
      sourceType: this.sourceType,
      probability: clampProbability(input.ourProbPrePlatt + trendAdjustment),
      active: true,
      confidence: rates.length >= 5 ? 'medium' : 'low',
      sampleCount: rates.length,
      bucketKey: `trend:${trendAdjustment >= 0 ? 'loosening' : 'tightening'}`,
      missingReasons: [],
      metadata: {
        yearlyRates: rates,
        slope,
        trendAdjustment,
      },
    };
  }
}
