import { CompliantDistillationService } from './compliant-distillation.service';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
  TeacherSignalProvider,
} from './types';

function buildInput(
  overrides?: Partial<DistillationEvaluationInput>,
): DistillationEvaluationInput {
  return {
    profileId: 'profile-1',
    schoolId: 'uc-berkeley',
    schoolCountry: 'US',
    profile: {
      nationality: 'US',
      isInternational: false,
      testScores: [],
    } as any,
    profileMetrics: {} as any,
    school: {
      acceptanceRate: 11,
      satAvg: 1415,
      actAvg: 32,
    } as any,
    ourProbPrePlatt: 0.12,
    servedProbability: 0.12,
    cohortKey: 'US__US_HS',
    applicationRound: 'RD',
    selectivityBand: 'REACH',
    inputSummary: {
      sat: 1550,
      act: 34,
      gpaNormalized: 0.98,
      nationality: 'US',
      curriculumType: null,
      highSchoolType: 'US_HS',
      isInternational: false,
    },
    ...overrides,
  };
}

function signal(
  overrides: Partial<DistillationTeacherSignal>,
): Omit<
  DistillationTeacherSignal,
  'configuredWeight' | 'effectiveBlendWeight'
> {
  return {
    key: 'scorecard-v1',
    label: 'teacher',
    sourceName: 'distillation:scorecard-v1',
    sourceType: 'OFFICIAL_FEDERAL',
    probability: null,
    active: false,
    confidence: 'low',
    missingReasons: ['missing'],
    ...overrides,
  } as Omit<
    DistillationTeacherSignal,
    'configuredWeight' | 'effectiveBlendWeight'
  >;
}

function teacher(
  key: DistillationTeacherSignal['key'],
  result: Omit<
    DistillationTeacherSignal,
    'configuredWeight' | 'effectiveBlendWeight'
  >,
  defaultWeight = 0.12,
): TeacherSignalProvider {
  return {
    key,
    label: result.label,
    sourceType: result.sourceType,
    defaultWeight,
    evaluate: jest.fn().mockResolvedValue(result),
  };
}

function inactiveTeacher(key: DistillationTeacherSignal['key']) {
  return teacher(
    key,
    signal({
      key,
      sourceName: `distillation:${key}`,
      sourceType: 'MANUAL_RESEARCH',
    }),
  );
}

describe('CompliantDistillationService', () => {
  const policyService = {
    resolveCohortKey: jest.fn().mockReturnValue('US__US_HS'),
  };
  const rollupService = {
    isChinaCohortEligibleForLive: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    rollupService.isChinaCohortEligibleForLive.mockResolvedValue(false);
  });

  it('allows live blend for exact cohort-prior signals outside China cohorts', async () => {
    const service = new CompliantDistillationService(
      policyService as any,
      rollupService as any,
      teacher(
        'scorecard-v1',
        signal({
          active: true,
          probability: 0.22,
          missingReasons: [],
        }),
      ) as any,
      inactiveTeacher('ipeds-trend-v1') as any,
      inactiveTeacher('cn-case-v1') as any,
      inactiveTeacher('cn-outcome-v1') as any,
      teacher(
        'cohort-prior-v1',
        signal({
          key: 'cohort-prior-v1',
          sourceName: 'distillation:cohort-prior-v1',
          sourceType: 'INTERNAL_CASES',
          active: true,
          probability: 0.55,
          sampleCount: 31,
          bucketKey: 'exact',
          missingReasons: [],
          metadata: { tier: 'exact' },
        }),
      ) as any,
    );

    const result = await service.evaluatePrediction(buildInput(), {
      shadowEnabled: false,
      liveEnabled: true,
    });

    expect(result?.applyLiveBlend).toBe(true);
    expect(result?.stage).toBe('DISTILLATION_LIVE');
    expect(result?.decision.liveEligible).toBe(true);
    expect(result?.decision.coverageTier).toBe('BASELINE_ONLY');
    expect(result?.decision.totalEffectiveWeight).toBeCloseTo(0.24, 6);
    expect(rollupService.isChinaCohortEligibleForLive).not.toHaveBeenCalled();
  });

  it('keeps public-only baseline signals in shadow when live flag is on', async () => {
    const service = new CompliantDistillationService(
      policyService as any,
      rollupService as any,
      teacher(
        'scorecard-v1',
        signal({
          active: true,
          probability: 0.22,
          missingReasons: [],
        }),
      ) as any,
      inactiveTeacher('ipeds-trend-v1') as any,
      inactiveTeacher('cn-case-v1') as any,
      inactiveTeacher('cn-outcome-v1') as any,
      inactiveTeacher('cohort-prior-v1') as any,
    );

    const result = await service.evaluatePrediction(buildInput(), {
      shadowEnabled: false,
      liveEnabled: true,
    });

    expect(result?.applyLiveBlend).toBe(false);
    expect(result?.stage).toBe('DISTILLATION_SHADOW');
    expect(result?.decision.liveEligible).toBe(false);
    expect(result?.decision.coverageTier).toBe('BASELINE_ONLY');
    expect(result?.decision.totalEffectiveWeight).toBeCloseTo(0.12, 6);
  });

  it('keeps newly added non-cohort teachers out of the live blend', async () => {
    const service = new CompliantDistillationService(
      policyService as any,
      rollupService as any,
      teacher(
        'scorecard-v1',
        signal({
          active: true,
          probability: 0.2,
          missingReasons: [],
        }),
      ) as any,
      inactiveTeacher('ipeds-trend-v1') as any,
      inactiveTeacher('cn-case-v1') as any,
      inactiveTeacher('cn-outcome-v1') as any,
      teacher(
        'cohort-prior-v1',
        signal({
          key: 'cohort-prior-v1',
          sourceName: 'distillation:cohort-prior-v1',
          sourceType: 'INTERNAL_CASES',
          active: true,
          probability: 0.4,
          sampleCount: 31,
          bucketKey: 'exact',
          missingReasons: [],
          metadata: { tier: 'exact' },
        }),
      ) as any,
      teacher(
        'cds-bands-v1',
        signal({
          key: 'cds-bands-v1',
          sourceName: 'distillation:cds-bands-v1',
          sourceType: 'OFFICIAL_SCHOOL',
          active: true,
          probability: 0.9,
          missingReasons: [],
        }),
        0.25,
      ) as any,
    );

    const result = await service.evaluatePrediction(buildInput(), {
      shadowEnabled: false,
      liveEnabled: true,
    });

    expect(result?.applyLiveBlend).toBe(true);
    expect(result?.decision.totalEffectiveWeight).toBeCloseTo(0.49, 6);
    expect(result?.decision.totalLiveEffectiveWeight).toBeCloseTo(0.24, 6);
    expect(result?.decision.blendedPrePlatt).toBeGreaterThan(
      result?.decision.liveBlendedPrePlatt ?? 0,
    );
  });

  it('does not live-serve broad cohort-prior fallback tiers', async () => {
    const service = new CompliantDistillationService(
      policyService as any,
      rollupService as any,
      inactiveTeacher('scorecard-v1') as any,
      inactiveTeacher('ipeds-trend-v1') as any,
      inactiveTeacher('cn-case-v1') as any,
      inactiveTeacher('cn-outcome-v1') as any,
      teacher(
        'cohort-prior-v1',
        signal({
          key: 'cohort-prior-v1',
          sourceName: 'distillation:cohort-prior-v1',
          sourceType: 'INTERNAL_CASES',
          active: true,
          probability: 0.35,
          sampleCount: 50,
          bucketKey: 'school-any',
          missingReasons: [],
          metadata: { tier: 'school-any' },
        }),
      ) as any,
    );

    const result = await service.evaluatePrediction(buildInput(), {
      shadowEnabled: false,
      liveEnabled: true,
    });

    expect(result?.applyLiveBlend).toBe(false);
    expect(result?.stage).toBe('DISTILLATION_SHADOW');
    expect(result?.decision.liveEligible).toBe(false);
    expect(result?.decision.coverageTier).toBe('BASELINE_ONLY');
  });

  it('preserves the China cohort gate for China-specific signals', async () => {
    rollupService.isChinaCohortEligibleForLive.mockResolvedValue(true);
    const service = new CompliantDistillationService(
      policyService as any,
      rollupService as any,
      inactiveTeacher('scorecard-v1') as any,
      inactiveTeacher('ipeds-trend-v1') as any,
      teacher(
        'cn-case-v1',
        signal({
          key: 'cn-case-v1',
          sourceName: 'distillation:cn-case-v1',
          sourceType: 'INTERNAL_CASES',
          active: true,
          probability: 0.4,
          missingReasons: [],
        }),
      ) as any,
      inactiveTeacher('cn-outcome-v1') as any,
      inactiveTeacher('cohort-prior-v1') as any,
    );

    const result = await service.evaluatePrediction(
      buildInput({ cohortKey: 'CN__CHINA_INTL' }),
      { shadowEnabled: false, liveEnabled: true },
    );

    expect(result?.applyLiveBlend).toBe(true);
    expect(result?.decision.liveEligible).toBe(true);
    expect(result?.decision.coverageTier).toBe('CN_ENHANCED');
    expect(rollupService.isChinaCohortEligibleForLive).toHaveBeenCalledWith(
      'CN__CHINA_INTL',
    );
  });
});
