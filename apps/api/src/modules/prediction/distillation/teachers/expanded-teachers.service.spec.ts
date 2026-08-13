import { CdsBandsTeacherService } from './cds-bands-teacher.service';
import { EdBoostTeacherService } from './ed-boost-teacher.service';
import { IntlPoolTeacherService } from './intl-pool-teacher.service';
import { MajorSelectivityTeacherService } from './major-selectivity-teacher.service';
import { ApRigorTeacherService } from './ap-rigor-teacher.service';
import type { DistillationEvaluationInput } from '../types';

const decimal = (value: number) => ({ toNumber: () => value });

function buildInput(
  overrides: Partial<DistillationEvaluationInput> = {},
): DistillationEvaluationInput {
  return {
    profileId: 'profile-1',
    schoolId: 'school-1',
    schoolCountry: 'US',
    profile: {
      gpa: 3.9,
      gpaScale: 4,
      targetMajor: 'Computer Science',
      isInternational: false,
      nationality: 'US',
      testScores: [{ type: 'SAT', score: 1520 }],
      activities: [],
      awards: [],
    },
    profileMetrics: { satScore: 1520 } as any,
    school: {
      id: 'school-1',
      name: 'Example University',
      acceptanceRate: 10,
      hasEarlyDecision: true,
    },
    ourProbPrePlatt: 0.2,
    servedProbability: 0.2,
    cohortKey: 'US__US_HS',
    applicationRound: 'RD',
    selectivityBand: null,
    inputSummary: {
      sat: 1520,
      act: null,
      gpaNormalized: 0.975,
      nationality: 'US',
      curriculumType: null,
      highSchoolType: 'US_HS',
      isInternational: false,
    },
    ...overrides,
  };
}

describe('expanded distillation teachers', () => {
  it('cds-bands prefers an exact SAT band over GPA-only fallback', async () => {
    const prisma = {
      schoolCdsAdmitBand: {
        findFirst: jest.fn().mockResolvedValueOnce({
          admitRate: decimal(0.72),
          sampleCount: 120,
          cycleYear: 2024,
          source: 'cds:test',
          sourceUrl: 'https://example.test',
        }),
      },
    };
    const result = await new CdsBandsTeacherService(prisma as any).evaluate(
      buildInput(),
    );

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.72);
    expect(result.bucketKey).toBe('3.75-4.00|SAT:1500-1600');
    expect(prisma.schoolCdsAdmitBand.findFirst).toHaveBeenCalledTimes(1);
  });

  it('cds-bands falls back to GPA-only when score band is missing', async () => {
    const prisma = {
      schoolCdsAdmitBand: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            admitRate: decimal(0.61),
            sampleCount: null,
            cycleYear: 2024,
            source: 'cds:test',
            sourceUrl: null,
          }),
      },
    };
    const result = await new CdsBandsTeacherService(prisma as any).evaluate(
      buildInput({
        inputSummary: {
          sat: null,
          act: 35,
          gpaNormalized: 0.975,
          nationality: 'US',
          curriculumType: null,
          highSchoolType: 'US_HS',
          isInternational: false,
        },
      }),
    );

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.61);
    expect(result.metadata).toMatchObject({ fallback: true });
  });

  it('ed-boost reads the latest matching early-round metric', async () => {
    const prisma = {
      schoolMetric: {
        findFirst: jest.fn().mockResolvedValue({
          metricKey: 'ed_acceptance_rate',
          value: decimal(25),
          year: 2024,
        }),
      },
    };
    const result = await new EdBoostTeacherService(prisma as any).evaluate(
      buildInput({ applicationRound: 'ED' }),
    );

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.25);
    expect(result.bucketKey).toBe('ED:ed_acceptance_rate');
  });

  it('major-selectivity uses explicit program acceptance estimates', async () => {
    const prisma = {
      schoolProgram: {
        findFirst: jest.fn().mockResolvedValue({
          cipCode: '1107',
          programName: 'Computer Science',
          competitiveness: 5,
          acceptanceRateEstimate: decimal(4),
        }),
      },
    };
    const result = await new MajorSelectivityTeacherService(
      prisma as any,
    ).evaluate(buildInput());

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.04);
    expect(result.metadata).toMatchObject({ usedExplicitRate: true });
  });

  it('intl-pool fires only for international profiles with an intl rate', async () => {
    const result = new IntlPoolTeacherService().evaluate(
      buildInput({
        profile: {
          targetMajor: 'Economics',
          isInternational: true,
          nationality: 'India',
          testScores: [],
          activities: [],
          awards: [],
        },
        school: {
          id: 'school-1',
          name: 'Example University',
          acceptanceRate: 10,
          intlAcceptanceRate: 3.5,
          intlStudentPct: 12,
          needBlindInternational: false,
        },
      }),
    );

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.035);
    expect(result.bucketKey).toBe('international');
  });

  it('case aggregate teachers read approved aggregate observations', async () => {
    const prisma = {
      predictionSourceObservation: {
        findFirst: jest.fn().mockResolvedValue({
          observedProbability: decimal(0.33),
          rate: null,
          confidenceLabel: 'medium',
          sampleCount: 20,
          sourceVersion: 'test',
          metadata: { bucketKey: 'ap:4_6' },
        }),
      },
    };
    const result = await new ApRigorTeacherService(prisma as any).evaluate(
      buildInput({
        profile: {
          targetMajor: 'Biology',
          isInternational: false,
          testScores: [
            { type: 'AP Biology', score: 5 },
            { type: 'AP Chemistry', score: 5 },
            { type: 'AP Calculus', score: 5 },
            { type: 'AP US History', score: 4 },
          ],
          activities: [],
          awards: [],
        },
      }),
    );

    expect(result.active).toBe(true);
    expect(result.probability).toBe(0.33);
    expect(result.bucketKey).toBe('ap:4_6');
  });
});
