import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { DistillationObservationService } from './distillation-observation.service';

describe('DistillationObservationService', () => {
  let service: DistillationObservationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistillationObservationService,
        {
          provide: PrismaService,
          useValue: {
            predictionSourceObservation: {
              createMany: jest.fn().mockResolvedValue({ count: 3 }),
            },
          },
        },
      ],
    }).compile();

    service = module.get(DistillationObservationService);
    prisma = module.get(PrismaService);
  });

  it('writes teacher rows plus a blend row for active signals', async () => {
    await service.record({
      profileId: 'profile-1',
      schoolId: 'school-1',
      predictionResultId: 'pred-1',
      predictionSnapshotId: 'snap-1',
      policyVersionId: 'policy-1',
      observedAt: new Date('2026-04-23T08:00:00.000Z'),
      stage: 'DISTILLATION_SHADOW',
      applicationRound: 'RD',
      selectivityBand: 'reach',
      ourProbPrePlatt: 0.22,
      candidateServedProbability: 0.2,
      servedProbability: 0.24,
      coverageTier: 'BASELINE_ONLY',
      inputSummary: {
        sat: 1480,
        act: null,
        gpaNormalized: 3.85,
        nationality: 'CHINA',
        curriculumType: 'US',
        highSchoolType: 'PUBLIC',
        isInternational: true,
      },
      decision: {
        hasSignal: true,
        coverageTier: 'BASELINE_ONLY',
        cohortKey: 'CN__CHINA_LOCAL',
        blendedPrePlatt: 0.2,
        totalConfiguredWeight: 0.15,
        totalEffectiveWeight: 0.12,
        liveEligible: false,
        teacherSignals: [
          {
            key: 'scorecard-v1',
            label: 'Scorecard',
            sourceName: 'distillation:scorecard-v1',
            sourceType: 'OFFICIAL_FEDERAL',
            configuredWeight: 0.12,
            effectiveBlendWeight: 0.12,
            probability: 0.18,
            active: true,
            confidence: 'medium',
            sampleCount: 1,
            missingReasons: [],
          },
          {
            key: 'cn-case-v1',
            label: 'CN Case',
            sourceName: 'distillation:cn-case-v1',
            sourceType: 'INTERNAL_CASES',
            configuredWeight: 0.12,
            effectiveBlendWeight: 0,
            probability: null,
            active: false,
            confidence: 'low',
            sampleCount: undefined,
            missingReasons: ['insufficient_chinese_cases'],
          },
        ],
      },
    });

    const call = (prisma.predictionSourceObservation.createMany as jest.Mock)
      .mock.calls[0][0];
    expect(call.data).toHaveLength(3);
    expect(call.data[0]).toEqual(
      expect.objectContaining({
        metricType: 'distillation_teacher',
        sourceName: 'distillation:scorecard-v1',
        observedProbability: 0.18,
        observedWeight: 0.12,
      }),
    );
    expect(call.data[2]).toEqual(
      expect.objectContaining({
        metricType: 'distillation_blend',
        sourceName: 'distillation:blend-v1',
        observedProbability: 0.2,
        observedWeight: 0.12,
        metadata: expect.objectContaining({
          activeTeacherKeys: ['scorecard-v1'],
          reason: null,
          servedProbability: 0.24,
        }),
      }),
    );
  });

  it('still writes a no-op blend row when no teachers are active', async () => {
    await service.record({
      profileId: 'profile-1',
      schoolId: 'school-1',
      predictionSnapshotId: 'snap-1',
      observedAt: new Date('2026-04-23T08:00:00.000Z'),
      stage: 'DISTILLATION_SHADOW',
      applicationRound: 'RD',
      selectivityBand: null,
      ourProbPrePlatt: 0.31,
      candidateServedProbability: 0.31,
      servedProbability: 0.31,
      coverageTier: 'NONE',
      inputSummary: {
        sat: null,
        act: null,
        gpaNormalized: null,
        nationality: null,
        curriculumType: null,
        highSchoolType: null,
        isInternational: false,
      },
      decision: {
        hasSignal: false,
        coverageTier: 'NONE',
        cohortKey: 'DOMESTIC',
        blendedPrePlatt: 0.31,
        totalConfiguredWeight: 0,
        totalEffectiveWeight: 0,
        liveEligible: false,
        teacherSignals: [],
      },
    });

    const call = (prisma.predictionSourceObservation.createMany as jest.Mock)
      .mock.calls[0][0];
    expect(call.data).toHaveLength(1);
    expect(call.data[0]).toEqual(
      expect.objectContaining({
        metricType: 'distillation_blend',
        metadata: expect.objectContaining({
          reason: 'no_active_teachers',
          hasSignal: false,
        }),
      }),
    );
  });
});
