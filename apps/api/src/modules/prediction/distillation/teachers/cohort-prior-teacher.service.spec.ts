import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CohortPriorTeacherService } from './cohort-prior-teacher.service';

type DecimalLike = { toNumber(): number };
const dec = (n: number): DecimalLike => ({ toNumber: () => n });

function buildInput(
  over: Partial<{
    schoolId: string;
    cohortKey: string;
    applicationRound: string;
  }> = {},
): any {
  return {
    profileId: 'p1',
    schoolId: 'school-mit',
    schoolCountry: 'US',
    profile: {} as any,
    profileMetrics: {} as any,
    school: {} as any,
    ourProbPrePlatt: 0.2,
    servedProbability: 0.2,
    cohortKey: 'CN__CHINA_INTL',
    applicationRound: 'ED',
    selectivityBand: 'hyper',
    inputSummary: {} as any,
    ...over,
  };
}

describe('CohortPriorTeacherService', () => {
  let service: CohortPriorTeacherService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortPriorTeacherService,
        {
          provide: PrismaService,
          useValue: {
            schoolCohortRoundPrior: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          },
        },
      ],
    }).compile();

    service = module.get(CohortPriorTeacherService);
    prisma = module.get(PrismaService);
  });

  it('returns inactive with no_prior_for_school when table is empty', async () => {
    const result = await service.evaluate(buildInput());
    expect(result.active).toBe(false);
    expect(result.probability).toBeNull();
    expect(result.missingReasons).toEqual(['no_prior_for_school']);
  });

  it('tier 1 exact match: hits on first findFirst and returns probability', async () => {
    (
      prisma.schoolCohortRoundPrior.findFirst as jest.Mock
    ).mockResolvedValueOnce({
      priorRate: dec(0.42),
      lowerBound: dec(0.3),
      upperBound: dec(0.54),
      sampleCount: 20,
      confidence: 'medium',
      setVersion: 'backfill-2026-04-24',
    });

    const result = await service.evaluate(
      buildInput({ schoolId: 'school-mit', cohortKey: 'CN__CHINA_INTL' }),
    );

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.42);
    expect(result.sampleCount).toBe(20);
    expect(result.bucketKey).toBe('exact');
    expect(result.confidence).toBe('medium'); // no downgrade at tier 1
    expect(result.metadata?.tier).toBe('exact');
    expect(result.metadata?.lowerBound).toBe(0.3);
    expect(result.metadata?.upperBound).toBe(0.54);
    // Exact match queries with the explicit round filter
    const call = (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mock
      .calls[0][0];
    expect(call.where).toMatchObject({
      schoolId: 'school-mit',
      cohortKey: 'CN__CHINA_INTL',
      round: 'ED',
      policyVersionId: null,
    });
  });

  it('tier 2 fallback: no exact match, any-round for cohort wins', async () => {
    (prisma.schoolCohortRoundPrior.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // tier 1 miss
      .mockResolvedValueOnce({
        priorRate: dec(0.35),
        lowerBound: dec(0.25),
        upperBound: dec(0.45),
        sampleCount: 15,
        confidence: 'medium',
        setVersion: 'backfill-2026-04-24',
      });

    const result = await service.evaluate(buildInput());

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.35);
    expect(result.bucketKey).toBe('cohort-any-round');
    // medium → low downgrade at tier 2
    expect(result.confidence).toBe('low');
  });

  it('tier 3 fallback: school+round any cohort wins, confidence = low', async () => {
    (prisma.schoolCohortRoundPrior.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // tier 1 miss
      .mockResolvedValueOnce(null) // tier 2 miss
      .mockResolvedValueOnce({
        priorRate: dec(0.15),
        lowerBound: dec(0.1),
        upperBound: dec(0.2),
        sampleCount: 30,
        confidence: 'high',
        setVersion: 'backfill-2026-04-24',
      });

    const result = await service.evaluate(buildInput());

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.15);
    expect(result.bucketKey).toBe('school-any-cohort-with-round');
    // tier 3 always low regardless of underlying confidence
    expect(result.confidence).toBe('low');
  });

  it('tier 4 fallback: school-any is last resort, still usable', async () => {
    (prisma.schoolCohortRoundPrior.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // tier 1 miss
      .mockResolvedValueOnce(null) // tier 2 miss
      .mockResolvedValueOnce(null) // tier 3 miss
      .mockResolvedValueOnce({
        priorRate: dec(0.1),
        lowerBound: dec(0.07),
        upperBound: dec(0.13),
        sampleCount: 50,
        confidence: 'high',
        setVersion: 'backfill-2026-04-24',
      });

    const result = await service.evaluate(buildInput());

    expect(result.bucketKey).toBe('school-any');
    expect(result.confidence).toBe('low');
  });

  it('rejects priors below MIN_SAMPLES at each tier (defense-in-depth)', async () => {
    // A tier 1 row with sampleCount=3 is below MIN_SAMPLES=5; skip and
    // try tier 2 (which is also below), etc.
    (prisma.schoolCohortRoundPrior.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        priorRate: dec(0.9),
        lowerBound: dec(0.5),
        upperBound: dec(1),
        sampleCount: 3,
        confidence: 'low',
        setVersion: 'backfill-2026-04-24',
      })
      .mockResolvedValueOnce(null) // tier 2
      .mockResolvedValueOnce(null) // tier 3
      .mockResolvedValueOnce(null); // tier 4

    const result = await service.evaluate(buildInput());
    expect(result.active).toBe(false);
    expect(result.probability).toBeNull();
  });

  it('no applicationRound → skips tier 1 and tier 3 queries', async () => {
    const findFirstMock = prisma.schoolCohortRoundPrior.findFirst as jest.Mock;
    // Miss tier 2 and tier 4 to force both to be attempted (no early exit).
    findFirstMock.mockResolvedValue(null);

    await service.evaluate(buildInput({ applicationRound: '' }));

    // Tier 1 + 3 are round-dependent and skipped; tier 2 and tier 4 still run.
    expect(findFirstMock).toHaveBeenCalledTimes(2);
    const whereArgs = findFirstMock.mock.calls.map((c) => c[0].where);
    // Neither call includes a `round` filter.
    for (const where of whereArgs) {
      expect(where.round).toBeUndefined();
    }
  });

  it('always filters by policyVersionId=null (policy-agnostic priors)', async () => {
    (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mockResolvedValue(
      null,
    );

    await service.evaluate(buildInput());

    const calls = (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mock
      .calls;
    for (const [arg] of calls) {
      expect(arg.where.policyVersionId).toBeNull();
    }
  });

  it('normalizes round to uppercase', async () => {
    (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mockResolvedValue(
      null,
    );
    await service.evaluate(buildInput({ applicationRound: 'ed' }));
    const call = (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mock
      .calls[0][0];
    expect(call.where.round).toBe('ED');
  });
});
