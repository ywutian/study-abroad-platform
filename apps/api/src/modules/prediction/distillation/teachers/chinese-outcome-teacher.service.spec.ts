import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ChineseOutcomeTeacherService } from './chinese-outcome-teacher.service';

describe('ChineseOutcomeTeacherService', () => {
  let service: ChineseOutcomeTeacherService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChineseOutcomeTeacherService,
        {
          provide: PrismaService,
          useValue: {
            predictionSnapshot: {
              groupBy: jest.fn().mockResolvedValue([
                { outcomeLabel: 'ADMITTED', _count: 12 },
                { outcomeLabel: 'REJECTED', _count: 18 },
              ]),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ChineseOutcomeTeacherService);
    prisma = module.get(PrismaService);
  });

  it('filters snapshot groupBy to authority=AUTHORITATIVE only', async () => {
    await service.evaluate({
      profileId: 'profile-1',
      schoolId: 'school-1',
      schoolCountry: 'US',
      profile: {
        gpa: 3.9,
        gpaScale: 4,
        testScores: [],
        activities: [],
        awards: [],
        nationality: 'China',
        educationSystem: 'AP',
        currentSchoolType: 'INTERNATIONAL',
        highSchoolType: 'INTERNATIONAL',
        isInternational: true,
      } as any,
      profileMetrics: {} as any,
      school: {} as any,
      ourProbPrePlatt: 0.12,
      servedProbability: 0.12,
      cohortKey: 'CN__CHINA_INTL',
      applicationRound: 'RD',
      selectivityBand: 'reach',
      inputSummary: {
        sat: 1400,
        act: null,
        gpaNormalized: 3.9,
        nationality: 'China',
        curriculumType: 'AP',
        highSchoolType: 'INTL_CN',
        isInternational: true,
      },
    });

    // Assert every call to groupBy filters by authority=AUTHORITATIVE so
    // PREVIEW (school-list quick-match) snapshots never contribute to the
    // Chinese cohort admission-rate buckets.
    const calls = (prisma.predictionSnapshot.groupBy as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [arg] of calls) {
      expect(arg.where.authority).toBe('AUTHORITATIVE');
    }
  });
});
