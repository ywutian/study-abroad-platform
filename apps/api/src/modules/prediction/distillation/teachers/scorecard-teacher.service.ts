import { Injectable } from '@nestjs/common';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import { normalCDF } from '../../utils/score-calculator';

const DEFAULT_WEIGHT = 0.12;

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

function percentileToMultiplier(percentile: number): number {
  if (percentile >= 0.75) return 1.5;
  if (percentile >= 0.5) return 1.2;
  if (percentile >= 0.25) return 1.0;
  return 0.6;
}

type ScoreAxisResult = {
  axis: 'sat' | 'act';
  probability: number;
  percentile: number;
  multiplier: number;
  bucketKey: string;
  confidence: 'low' | 'medium';
  mode: 'distribution' | 'average_only';
};

function fallbackPercentileFromDelta(
  axis: 'sat' | 'act',
  delta: number,
): number {
  if (axis === 'sat') {
    if (delta >= 100) return 0.75;
    if (delta >= 30) return 0.5;
    if (delta >= -40) return 0.25;
    return 0.1;
  }

  if (delta >= 3) return 0.75;
  if (delta >= 1) return 0.5;
  if (delta >= -1) return 0.25;
  return 0.1;
}

@Injectable()
export class ScorecardTeacherService implements TeacherSignalProvider {
  readonly key = 'scorecard-v1' as const;
  readonly label = 'Scorecard Conditional Probability';
  readonly sourceType = 'OFFICIAL_FEDERAL' as const;
  readonly defaultWeight = DEFAULT_WEIGHT;

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const baseRate =
      input.school.acceptanceRate != null
        ? input.school.acceptanceRate / 100
        : null;

    if (!baseRate || !Number.isFinite(baseRate)) {
      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:scorecard-v1',
        sourceType: this.sourceType,
        probability: null,
        active: false,
        confidence: 'low',
        missingReasons: ['missing_acceptance_rate'],
      };
    }

    const axisResults = [
      this.evaluateSat(baseRate, input),
      this.evaluateAct(baseRate, input),
    ].filter((value): value is ScoreAxisResult => Boolean(value));

    if (axisResults.length === 0) {
      return {
        key: this.key,
        label: this.label,
        sourceName: 'distillation:scorecard-v1',
        sourceType: this.sourceType,
        probability: null,
        active: false,
        confidence: 'low',
        missingReasons: ['missing_test_score_or_distribution'],
        metadata: {
          schoolAcceptanceRate: baseRate,
        },
      };
    }

    const probability =
      axisResults.reduce((sum, axis) => sum + axis.probability, 0) /
      axisResults.length;

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:scorecard-v1',
      sourceType: this.sourceType,
      probability: clampProbability(probability),
      active: true,
      confidence: this.resolveConfidence(axisResults),
      sampleCount: axisResults.length,
      bucketKey: axisResults.map((axis) => axis.bucketKey).join('|'),
      missingReasons: [],
      metadata: {
        schoolAcceptanceRate: baseRate,
        axes: axisResults,
      },
    };
  }

  private evaluateSat(
    baseRate: number,
    input: DistillationEvaluationInput,
  ): ScoreAxisResult | null {
    const satScore = input.inputSummary.sat;
    const satAvg = input.school.satAvg;
    const sat25 = input.school.sat25;
    const sat75 = input.school.sat75;

    if (satScore == null || satAvg == null) {
      return null;
    }

    if (sat25 != null && sat75 != null && sat75 > sat25) {
      const sigma = (sat75 - sat25) / 1.349;
      if (!Number.isFinite(sigma) || sigma <= 0) return null;

      const percentile = normalCDF((satScore - satAvg) / sigma);
      const multiplier = percentileToMultiplier(percentile);

      return {
        axis: 'sat',
        probability: clampProbability(baseRate * multiplier),
        percentile,
        multiplier,
        bucketKey: `sat:${percentile.toFixed(2)}`,
        confidence: 'medium',
        mode: 'distribution',
      };
    }

    const percentile = fallbackPercentileFromDelta('sat', satScore - satAvg);
    const multiplier = percentileToMultiplier(percentile);

    return {
      axis: 'sat',
      probability: clampProbability(baseRate * multiplier),
      percentile,
      multiplier,
      bucketKey: `sat_avg_only:${percentile.toFixed(2)}`,
      confidence: 'low',
      mode: 'average_only',
    };
  }

  private evaluateAct(
    baseRate: number,
    input: DistillationEvaluationInput,
  ): ScoreAxisResult | null {
    const actScore = input.inputSummary.act;
    const actAvg = input.school.actAvg;
    const act25 = input.school.act25;
    const act75 = input.school.act75;

    if (actScore == null || actAvg == null) {
      return null;
    }

    if (act25 != null && act75 != null && act75 > act25) {
      const sigma = (act75 - act25) / 1.349;
      if (!Number.isFinite(sigma) || sigma <= 0) return null;

      const percentile = normalCDF((actScore - actAvg) / sigma);
      const multiplier = percentileToMultiplier(percentile);

      return {
        axis: 'act',
        probability: clampProbability(baseRate * multiplier),
        percentile,
        multiplier,
        bucketKey: `act:${percentile.toFixed(2)}`,
        confidence: 'medium',
        mode: 'distribution',
      };
    }

    const percentile = fallbackPercentileFromDelta('act', actScore - actAvg);
    const multiplier = percentileToMultiplier(percentile);

    return {
      axis: 'act',
      probability: clampProbability(baseRate * multiplier),
      percentile,
      multiplier,
      bucketKey: `act_avg_only:${percentile.toFixed(2)}`,
      confidence: 'low',
      mode: 'average_only',
    };
  }

  private resolveConfidence(
    axisResults: ScoreAxisResult[],
  ): 'low' | 'medium' | 'high' {
    const distributionAxes = axisResults.filter(
      (axis) => axis.mode === 'distribution',
    ).length;

    if (distributionAxes === axisResults.length && axisResults.length === 2) {
      return 'high';
    }
    if (distributionAxes >= 1) {
      return 'medium';
    }
    return 'low';
  }
}
