import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ChineseCaseTeacherService } from './chinese-case-teacher.service';

describe('ChineseCaseTeacherService', () => {
  let service: ChineseCaseTeacherService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChineseCaseTeacherService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: {
              groupBy: jest
                .fn()
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                  { result: 'ADMITTED', _count: 8 },
                  { result: 'REJECTED', _count: 4 },
                ]),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ChineseCaseTeacherService);
    prisma = module.get(PrismaService);
  });

  it('normalizes INTERNATIONAL highSchoolType to INTL_CN for China cohorts', async () => {
    const result = await service.evaluate({
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
      },
      profileMetrics: {} as any,
      school: {} as any,
      ourProbPrePlatt: 0.12,
      servedProbability: 0.12,
      cohortKey: 'CN__CHINA_INTL',
      applicationRound: 'ED',
      selectivityBand: 'reach',
      inputSummary: {
        sat: null,
        act: null,
        gpaNormalized: 3.9,
        nationality: 'CHINA',
        curriculumType: 'AP',
        highSchoolType: 'INTERNATIONAL',
        isInternational: true,
      },
    });

    const calls = (prisma.admissionCase.groupBy as jest.Mock).mock.calls;
    expect(calls[0][0].where.highSchoolType).toBe('INTL_CN');
    expect(calls[1][0].where.highSchoolType).toBe('INTL_CN');
    expect(result.active).toBe(true);
    expect(result.sampleCount).toBe(12);
    expect(result.bucketKey).toBe('school:nationality:curriculum:hs');
  });
});
