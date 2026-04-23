import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { DistillationStatsRollupService } from './distillation-stats-rollup.service';

describe('DistillationStatsRollupService', () => {
  let service: DistillationStatsRollupService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      predictionSourceObservation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      distillationDailyAggregate: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      distillationSchoolDailyAggregate: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      school: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation((input: unknown) => {
        if (typeof input === 'function') {
          return (input as (tx: typeof prismaMock) => unknown)(prismaMock);
        }
        return Promise.all(input as Array<Promise<unknown>>);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistillationStatsRollupService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(DistillationStatsRollupService);
    prisma = module.get(PrismaService);
  });

  it('rolls raw teacher and blend observations into daily and school aggregates', async () => {
    (
      prisma.predictionSourceObservation.findMany as jest.Mock
    ).mockResolvedValue([
      {
        id: 'obs-teacher',
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        observationStage: 'DISTILLATION_SHADOW',
        metricType: 'distillation_teacher',
        sourceName: 'distillation:scorecard-v1',
        observedAt: new Date('2026-04-23T08:00:00.000Z'),
        observedProbability: 0.2,
        observedWeight: 0.12,
        selectivityBand: 'reach',
        metadata: {
          active: true,
          deltaVsOur: -0.02,
        },
        predictionSnapshot: { outcomeLabel: 'ADMITTED' },
      },
      {
        id: 'obs-blend',
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        observationStage: 'DISTILLATION_SHADOW',
        metricType: 'distillation_blend',
        sourceName: 'distillation:blend-v1',
        observedAt: new Date('2026-04-23T08:00:00.000Z'),
        observedProbability: 0.21,
        observedWeight: 0.12,
        selectivityBand: 'reach',
        metadata: {
          hasSignal: true,
          activeTeacherKeys: ['scorecard-v1'],
          coverageTier: 'BASELINE_ONLY',
          servedProbability: 0.24,
          blendDelta: -0.03,
        },
        predictionSnapshot: { outcomeLabel: 'ADMITTED' },
      },
    ]);

    await service.recomputeWindow({
      startDate: new Date('2026-04-23T00:00:00.000Z'),
      endDate: new Date('2026-04-23T23:59:59.999Z'),
    });

    expect(prisma.distillationDailyAggregate.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          teacherKey: 'scorecard-v1',
          cohortKey: 'CN__CHINA_LOCAL',
          predictionCount: 1,
          activeSignalCount: 1,
          resolvedOutcomeCount: 1,
          distinctSchoolCount: 1,
        }),
        expect.objectContaining({
          teacherKey: 'blend-v1',
          brierBlended: expect.any(Number),
          brierServed: expect.any(Number),
        }),
      ]),
    });
    expect(
      prisma.distillationSchoolDailyAggregate.createMany,
    ).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          schoolId: 'school-1',
          cohortKey: 'CN__CHINA_LOCAL',
          coverageTier: 'BASELINE_ONLY',
          predictionCount: 1,
          resolvedOutcomeCount: 1,
          activeTeacherKeys: ['scorecard-v1'],
        }),
      ]),
    });
  });

  it('evaluates China cohort live gates from aggregates', async () => {
    (prisma.distillationDailyAggregate.findMany as jest.Mock).mockResolvedValue(
      [
        {
          resolvedOutcomeCount: 50,
          brierBlended: 0.09,
          brierServed: 0.13,
        },
      ],
    );
    (prisma.school.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        id: `school-${index + 1}`,
      })),
    );
    (
      prisma.distillationSchoolDailyAggregate.findFirst as jest.Mock
    ).mockResolvedValue({
      date: new Date('2026-04-23T00:00:00.000Z'),
    });
    (
      prisma.distillationSchoolDailyAggregate.findMany as jest.Mock
    ).mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => ({
        schoolId: `school-${index + 1}`,
        coverageTier: 'CN_ENHANCED',
      })),
    );

    const gate = await service.getChinaCohortGate('CN__CHINA_LOCAL');

    expect(gate).toEqual(
      expect.objectContaining({
        cohortKey: 'CN__CHINA_LOCAL',
        eligible: true,
        resolvedOutcomeCount: 50,
        top100CoverageRate: 0.6,
        reasons: [],
      }),
    );
  });
});
