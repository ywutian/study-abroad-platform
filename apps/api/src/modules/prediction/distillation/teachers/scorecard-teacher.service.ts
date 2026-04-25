import { Injectable } from '@nestjs/common';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';
import { normalCDF } from '../../utils/score-calculator';

const DEFAULT_WEIGHT = 0.12;
const SAT_AVG_ONLY_SIGMA = 100;
const ACT_AVG_ONLY_SIGMA = 3;

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

function percentileToMultiplier(percentile: number): number {
  // Linear mapping: p=0.5 -> 1.0, p=0.75 -> 1.5, p=0.9 -> 1.8.
  // Clamp the tails so one axis cannot push the product past plausible bounds.
  return Math.max(0.2, Math.min(2.0, 2 * percentile));
}

type ScoreAxisResult = {
  axis: 'sat' | 'act' | 'gpa';
  probability: number;
  percentile: number;
  multiplier: number;
  bucketKey: string;
  confidence: 'low' | 'medium';
  mode: 'distribution' | 'heuristic_avg' | 'heuristic_gpa';
};

@Injectable()
export class ScorecardTeacherService implements TeacherSignalProvider {
  // Keep the persisted teacher key stable; diagnostics distinguish v2 behavior.
  readonly key = 'scorecard-v1' as const;
  readonly version = 2 as const;
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
      this.evaluateGpa(baseRate, input),
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
          scorecardVersion: this.version,
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
        scorecardVersion: this.version,
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

    const percentile = normalCDF((satScore - satAvg) / SAT_AVG_ONLY_SIGMA);
    const multiplier = percentileToMultiplier(percentile);

    return {
      axis: 'sat',
      probability: clampProbability(baseRate * multiplier),
      percentile,
      multiplier,
      bucketKey: `sat_avg:${percentile.toFixed(2)}`,
      confidence: 'low',
      mode: 'heuristic_avg',
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

    const percentile = normalCDF((actScore - actAvg) / ACT_AVG_ONLY_SIGMA);
    const multiplier = percentileToMultiplier(percentile);

    return {
      axis: 'act',
      probability: clampProbability(baseRate * multiplier),
      percentile,
      multiplier,
      bucketKey: `act_avg:${percentile.toFixed(2)}`,
      confidence: 'low',
      mode: 'heuristic_avg',
    };
  }

  private evaluateGpa(
    baseRate: number,
    input: DistillationEvaluationInput,
  ): ScoreAxisResult | null {
    const gpaNormalized = input.inputSummary.gpaNormalized;
    if (gpaNormalized == null) return null;

    // Schema has no school-level GPA stats; derive expected GPA from the
    // school's selectivity until school-specific GPA distributions exist.
    const expectedGpa = this.expectedGpaForSelectivity(baseRate);
    const sigma = 0.04;

    const percentile = normalCDF((gpaNormalized - expectedGpa) / sigma);
    const multiplier = percentileToMultiplier(percentile);

    return {
      axis: 'gpa',
      probability: clampProbability(baseRate * multiplier),
      percentile,
      multiplier,
      bucketKey: `gpa:${percentile.toFixed(2)}`,
      confidence: 'low',
      mode: 'heuristic_gpa',
    };
  }

  private expectedGpaForSelectivity(baseRate: number): number {
    if (baseRate < 0.1) return 0.975;
    if (baseRate < 0.25) return 0.95;
    if (baseRate < 0.5) return 0.9;
    return 0.85;
  }

  private resolveConfidence(
    axisResults: ScoreAxisResult[],
  ): 'low' | 'medium' | 'high' {
    const distributionAxes = axisResults.filter(
      (axis) => axis.mode === 'distribution',
    ).length;

    // GPA is heuristic and low-confidence; only both distribution-backed test
    // axes can promote the teacher to high confidence.
    if (distributionAxes === 2 && axisResults.length >= 2) {
      return 'high';
    }
    if (distributionAxes >= 1) {
      return 'medium';
    }
    return 'low';
  }
}
