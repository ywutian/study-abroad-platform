import type { PredictionObservationSourceType } from '@prisma/client';
import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import type { ProfileMetrics } from '../utils/score-calculator';

export const DISTILLATION_SHADOW_STAGE = 'DISTILLATION_SHADOW';
export const DISTILLATION_LIVE_STAGE = 'DISTILLATION_LIVE';

export const DISTILLATION_TEACHER_KEYS = [
  'scorecard-v1',
  'ipeds-trend-v1',
  'cn-case-v1',
  'cn-outcome-v1',
  'blend-v1',
] as const;

export type DistillationTeacherKey =
  | 'scorecard-v1'
  | 'ipeds-trend-v1'
  | 'cn-case-v1'
  | 'cn-outcome-v1';

export type DistillationCoverageTier = 'NONE' | 'BASELINE_ONLY' | 'CN_ENHANCED';

export type DistillationInputSummary = {
  sat: number | null;
  act: number | null;
  gpaNormalized: number | null;
  nationality: string | null;
  curriculumType: string | null;
  highSchoolType: string | null;
  isInternational: boolean;
};

export type DistillationEvaluationInput = {
  profileId: string;
  schoolId: string;
  schoolCountry: string | null | undefined;
  profile: ProfileInput;
  profileMetrics: ProfileMetrics;
  school: SchoolInput;
  ourProbPrePlatt: number;
  servedProbability: number;
  cohortKey: string;
  applicationRound: string;
  selectivityBand: string | null;
  inputSummary: DistillationInputSummary;
};

export type DistillationTeacherSignal = {
  key: DistillationTeacherKey;
  label: string;
  sourceName: `distillation:${DistillationTeacherKey}`;
  sourceType: PredictionObservationSourceType;
  configuredWeight: number;
  effectiveBlendWeight: number;
  probability: number | null;
  active: boolean;
  confidence: 'low' | 'medium' | 'high';
  sampleCount?: number;
  bucketKey?: string;
  missingReasons: string[];
  metadata?: Record<string, unknown>;
};

export type DistillationBlendDecision = {
  hasSignal: boolean;
  teacherSignals: DistillationTeacherSignal[];
  coverageTier: DistillationCoverageTier;
  cohortKey: string;
  blendedPrePlatt: number;
  totalConfiguredWeight: number;
  totalEffectiveWeight: number;
  liveEligible: boolean;
};

export type DistillationObservationPayload = {
  profileId: string;
  schoolId: string;
  predictionResultId?: string;
  predictionSnapshotId?: string;
  policyVersionId?: string;
  observedAt: Date;
  stage: typeof DISTILLATION_SHADOW_STAGE | typeof DISTILLATION_LIVE_STAGE;
  applicationRound: string;
  selectivityBand: string | null;
  ourProbPrePlatt: number;
  candidateServedProbability: number;
  servedProbability: number;
  coverageTier: DistillationCoverageTier;
  inputSummary: DistillationInputSummary;
  decision: DistillationBlendDecision;
};

export interface TeacherSignalProvider {
  readonly key: DistillationTeacherKey;
  readonly label: string;
  readonly sourceType: PredictionObservationSourceType;
  readonly defaultWeight: number;

  evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  >;
}
