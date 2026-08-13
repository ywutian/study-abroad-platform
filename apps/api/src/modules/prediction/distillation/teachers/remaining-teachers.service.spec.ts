import { GeoCohortTeacherService } from './geo-cohort-teacher.service';
import { HooksTeacherService } from './hooks-teacher.service';
import { IbTeacherService } from './ib-teacher.service';
import { IpedsTrendTeacherService } from './ipeds-trend-teacher.service';

const input = (overrides: Record<string, unknown> = {}) =>
  ({
    profileId: 'profile-1',
    schoolId: 'school-1',
    schoolCountry: 'US',
    profile: { testScores: [], activities: [], awards: [] },
    profileMetrics: {},
    school: {},
    ourProbPrePlatt: 0.2,
    servedProbability: 0.2,
    cohortKey: 'US__US_HS',
    applicationRound: 'RD',
    selectivityBand: 'TARGET',
    inputSummary: {},
    ...overrides,
  }) as any;

describe('remaining distillation teachers', () => {
  it('geo cohort stays inactive for a private school', async () => {
    const prisma = {
      school: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ state: 'CA', isPrivate: true }),
      },
      schoolMetric: { findFirst: jest.fn() },
    };
    const result = await new GeoCohortTeacherService(prisma as any).evaluate(
      input(),
    );
    expect(result.active).toBe(false);
    expect(result.missingReasons).toContain('school_not_public_with_state');
  });

  it('hooks excludes round-only shifts and reports no applicable hook', async () => {
    const hooks = {
      computeHookShifts: jest
        .fn()
        .mockReturnValue([{ hookType: 'ROUND_BONUS' }]),
      applyHooks: jest.fn(),
    };
    const result = new HooksTeacherService(hooks as any).evaluate(input());
    expect(result.active).toBe(false);
    expect(hooks.applyHooks).not.toHaveBeenCalled();
  });

  it('IB teacher does not query aggregates for a non-IB profile', async () => {
    const prisma = { predictionSourceObservation: { findFirst: jest.fn() } };
    const result = await new IbTeacherService(prisma as any).evaluate(input());
    expect(result.active).toBe(false);
    expect(prisma.predictionSourceObservation.findFirst).not.toHaveBeenCalled();
  });

  it('IPEDS trend requires three years of complete history', async () => {
    const prisma = {
      schoolMetric: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await new IpedsTrendTeacherService(prisma as any).evaluate(
      input(),
    );
    expect(result.active).toBe(false);
    expect(result.missingReasons).toEqual(['insufficient_ipeds_history']);
  });
});
