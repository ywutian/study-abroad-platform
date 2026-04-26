import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseAggregateBackfillService } from './case-aggregate-backfill.service';

const baseCase = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  schoolId: 'school-1',
  result: 'ADMITTED',
  apCount: 5,
  ibScore: null as number | null,
  activities: [
    { role: 'President', hoursPerWeek: 10, weeksPerYear: 40 },
    { role: 'Member', hoursPerWeek: 5, weeksPerYear: 30 },
  ],
  highSchool: { tier: 1 },
  ...over,
});

describe('CaseAggregateBackfillService', () => {
  let service: CaseAggregateBackfillService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseAggregateBackfillService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            predictionSourceObservation: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              createMany: jest
                .fn()
                .mockImplementation(({ data }) => ({ count: data.length })),
            },
          },
        },
      ],
    }).compile();

    service = module.get(CaseAggregateBackfillService);
    prisma = module.get(PrismaService);
  });

  it('returns empty preview when no cases exist (dryRun)', async () => {
    const result = await service.runBackfill({ dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.scanned).toBe(0);
    expect(result.eligibleBuckets).toBe(0);
    expect(result.written).toBe(0);
    expect(
      prisma.predictionSourceObservation.createMany,
    ).not.toHaveBeenCalled();
    expect(
      prisma.predictionSourceObservation.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it('aggregates cases into per-teacher buckets and respects MIN_SAMPLES', async () => {
    // 6 cases, all at school-1 with apCount=5, mix of ADMITTED/REJECTED
    (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
      baseCase({ id: 'c1', result: 'ADMITTED' }),
      baseCase({ id: 'c2', result: 'ADMITTED' }),
      baseCase({ id: 'c3', result: 'ADMITTED' }),
      baseCase({ id: 'c4', result: 'REJECTED' }),
      baseCase({ id: 'c5', result: 'REJECTED' }),
      baseCase({ id: 'c6', result: 'REJECTED' }),
    ]);

    const result = await service.runBackfill({ dryRun: true, minSamples: 5 });
    expect(result.scanned).toBe(6);
    expect(result.eligibleBuckets).toBeGreaterThan(0);
    // Should fire AP, Feeder HS, Activity teachers (IB has null ibScore so
    // we skip it). Each contributes 2 buckets (specific + :any).
    expect(result.eligibleByTeacher['ap-rigor-v1']).toBeGreaterThan(0);
    expect(result.eligibleByTeacher['feeder-hs-v1']).toBeGreaterThan(0);
    expect(result.eligibleByTeacher['activity-intensity-v1']).toBeGreaterThan(
      0,
    );
    expect(result.eligibleByTeacher['ib-v1']).toBe(0);
  });

  it('drops buckets under MIN_SAMPLES even if cases exist', async () => {
    (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
      baseCase({ id: 'c1', result: 'ADMITTED' }),
      baseCase({ id: 'c2', result: 'REJECTED' }),
    ]); // only 2 cases per bucket — below default MIN_SAMPLES=5

    const result = await service.runBackfill({ dryRun: true });
    expect(result.bucketsTotal).toBeGreaterThan(0);
    expect(result.eligibleBuckets).toBe(0);
    expect(result.droppedLowSample).toBeGreaterThan(0);
  });

  it('write mode: deletes prior setVersion rows and inserts fresh', async () => {
    (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) =>
        baseCase({ id: `c${i}`, result: i < 4 ? 'ADMITTED' : 'REJECTED' }),
      ),
    );
    (
      prisma.predictionSourceObservation.deleteMany as jest.Mock
    ).mockResolvedValue({
      count: 7,
    });

    const result = await service.runBackfill({
      dryRun: false,
      setVersion: 'case-aggregate-teachers-2026-04-26-test',
    });

    expect(result.dryRun).toBe(false);
    expect(result.deleted).toBe(7);
    expect(result.written).toBeGreaterThan(0);
    expect(prisma.predictionSourceObservation.deleteMany).toHaveBeenCalledWith({
      where: {
        sourceName: {
          in: [
            'distillation:ap-rigor-v1',
            'distillation:ib-v1',
            'distillation:feeder-hs-v1',
            'distillation:activity-intensity-v1',
          ],
        },
        sourceVersion: 'case-aggregate-teachers-2026-04-26-test',
      },
    });
    expect(prisma.predictionSourceObservation.createMany).toHaveBeenCalled();
  });

  it('default setVersion encodes today (case-aggregate-teachers-YYYY-MM-DD)', async () => {
    (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([]);
    const result = await service.runBackfill({ dryRun: true });
    const today = new Date().toISOString().slice(0, 10);
    expect(result.setVersion).toBe(`case-aggregate-teachers-${today}`);
  });

  it('preview rows are capped at 20 even when many eligible', async () => {
    // Generate 30 eligible buckets by mixing schools
    const cases = Array.from({ length: 30 }, (_, i) =>
      baseCase({
        id: `c${i}`,
        schoolId: `school-${Math.floor(i / 6)}`,
        result: i % 2 === 0 ? 'ADMITTED' : 'REJECTED',
      }),
    );
    // Need >= 5 per bucket — 6 per school across 5 schools, with multiple
    // teachers each → many eligible buckets
    (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(cases);

    const result = await service.runBackfill({ dryRun: true });
    expect(result.preview.length).toBeLessThanOrEqual(20);
  });
});
