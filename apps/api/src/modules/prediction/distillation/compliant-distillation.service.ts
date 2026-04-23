import { Injectable } from '@nestjs/common';
import { normalizeGpa } from '../utils/score-calculator';
import { PredictionPolicyService } from '../prediction-policy.service';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';
import {
  DISTILLATION_LIVE_STAGE,
  DISTILLATION_SHADOW_STAGE,
  type DistillationBlendDecision,
  type DistillationCoverageTier,
  type DistillationEvaluationInput,
  type DistillationInputSummary,
  type DistillationTeacherSignal,
  type TeacherSignalProvider,
} from './types';
import { ScorecardTeacherService } from './teachers/scorecard-teacher.service';
import { IpedsTrendTeacherService } from './teachers/ipeds-trend-teacher.service';
import { ChineseCaseTeacherService } from './teachers/chinese-case-teacher.service';
import { ChineseOutcomeTeacherService } from './teachers/chinese-outcome-teacher.service';

const CHINA_COHORT_PREFIX = 'CN__';
const PUBLIC_TEACHERS = new Set(['scorecard-v1', 'ipeds-trend-v1']);

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value));
}

@Injectable()
export class CompliantDistillationService {
  private readonly teachers: TeacherSignalProvider[];

  constructor(
    private readonly policyService: PredictionPolicyService,
    private readonly rollupService: DistillationStatsRollupService,
    scorecardTeacher: ScorecardTeacherService,
    ipedsTrendTeacher: IpedsTrendTeacherService,
    chineseCaseTeacher: ChineseCaseTeacherService,
    chineseOutcomeTeacher: ChineseOutcomeTeacherService,
  ) {
    this.teachers = [
      scorecardTeacher,
      ipedsTrendTeacher,
      chineseCaseTeacher,
      chineseOutcomeTeacher,
    ];
  }

  buildInputSummary(
    profile: DistillationEvaluationInput['profile'],
    profileMetrics: DistillationEvaluationInput['profileMetrics'],
  ): DistillationInputSummary {
    const sat =
      profileMetrics.satScore ??
      profile.testScores.find((score) => score.type.toUpperCase() === 'SAT')
        ?.score ??
      null;
    const act =
      profileMetrics.actScore ??
      profile.testScores.find((score) => score.type.toUpperCase() === 'ACT')
        ?.score ??
      null;
    const gpaNormalized =
      profile.gpa != null
        ? normalizeGpa(profile.gpa, profile.gpaScale || 4, profile.gpaSystem)
        : null;

    return {
      sat: sat ?? null,
      act: act ?? null,
      gpaNormalized,
      nationality: profile.nationality?.toUpperCase() ?? null,
      curriculumType: profile.educationSystem ?? null,
      highSchoolType:
        profile.highSchoolType ?? profile.currentSchoolType ?? null,
      isInternational: Boolean(profile.isInternational),
    };
  }

  resolveCohortKey(profile: DistillationEvaluationInput['profile']): string {
    return this.policyService.resolveCohortKey(profile);
  }

  async evaluatePrediction(
    input: DistillationEvaluationInput,
    options?: {
      shadowEnabled?: boolean;
      liveEnabled?: boolean;
    },
  ): Promise<{
    decision: DistillationBlendDecision;
    stage:
      | typeof DISTILLATION_SHADOW_STAGE
      | typeof DISTILLATION_LIVE_STAGE
      | null;
    applyLiveBlend: boolean;
  } | null> {
    if (input.schoolCountry && input.schoolCountry !== 'US') {
      return null;
    }

    const teacherSignals = await Promise.all(
      this.teachers.map(async (teacher) => {
        const result = await teacher.evaluate(input);
        return {
          ...result,
          configuredWeight: this.readConfiguredWeight(
            teacher.key,
            teacher.defaultWeight,
          ),
          effectiveBlendWeight: 0,
        } satisfies DistillationTeacherSignal;
      }),
    );

    const activeSignals = teacherSignals.filter(
      (signal) =>
        signal.active &&
        signal.probability != null &&
        signal.configuredWeight > 0,
    );

    const activeChinaSignals = activeSignals.filter(
      (signal) => !PUBLIC_TEACHERS.has(signal.key),
    );
    const activePublicSignals = activeSignals.filter((signal) =>
      PUBLIC_TEACHERS.has(signal.key),
    );

    const coverageTier: DistillationCoverageTier =
      activeChinaSignals.length > 0
        ? 'CN_ENHANCED'
        : activePublicSignals.length > 0
          ? 'BASELINE_ONLY'
          : 'NONE';

    const maxTotalWeight =
      activeChinaSignals.length > 0
        ? 0.35
        : activePublicSignals.length > 1
          ? 0.15
          : activePublicSignals.length === 1
            ? 0.1
            : 0;
    const totalConfiguredWeight = activeSignals.reduce(
      (sum, signal) => sum + signal.configuredWeight,
      0,
    );
    const scale =
      totalConfiguredWeight > 0 && totalConfiguredWeight > maxTotalWeight
        ? maxTotalWeight / totalConfiguredWeight
        : 1;
    const weightedSignals = teacherSignals.map((signal) =>
      signal.active && signal.probability != null
        ? {
            ...signal,
            effectiveBlendWeight: signal.configuredWeight * scale,
          }
        : signal,
    );

    const totalEffectiveWeight = weightedSignals.reduce(
      (sum, signal) => sum + signal.effectiveBlendWeight,
      0,
    );
    const blendedPrePlatt =
      totalEffectiveWeight > 0
        ? clampProbability(
            (1 - totalEffectiveWeight) * input.ourProbPrePlatt +
              weightedSignals.reduce(
                (sum, signal) =>
                  sum + (signal.probability ?? 0) * signal.effectiveBlendWeight,
                0,
              ),
          )
        : input.ourProbPrePlatt;

    const chinaCohort = input.cohortKey.startsWith(CHINA_COHORT_PREFIX);
    const liveEligible =
      chinaCohort && activeChinaSignals.length > 0
        ? await this.rollupService.isChinaCohortEligibleForLive(input.cohortKey)
        : false;
    const applyLiveBlend = Boolean(options?.liveEnabled) && liveEligible;
    const stage = applyLiveBlend
      ? DISTILLATION_LIVE_STAGE
      : options?.shadowEnabled || options?.liveEnabled
        ? DISTILLATION_SHADOW_STAGE
        : null;

    return {
      decision: {
        hasSignal: activeSignals.length > 0,
        teacherSignals: weightedSignals,
        coverageTier,
        cohortKey: input.cohortKey,
        blendedPrePlatt,
        totalConfiguredWeight,
        totalEffectiveWeight,
        liveEligible,
      },
      stage,
      applyLiveBlend,
    };
  }

  private readConfiguredWeight(key: string, fallback: number): number {
    const envKey = `COMPLIANT_DISTILLATION_WEIGHT_${key
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')}`;
    const value = process.env[envKey];
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
  }
}
