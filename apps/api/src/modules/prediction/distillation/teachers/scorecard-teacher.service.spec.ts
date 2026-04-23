import { ScorecardTeacherService } from './scorecard-teacher.service';
import type { DistillationEvaluationInput } from '../types';

function buildInput(
  overrides?: Partial<DistillationEvaluationInput>,
): DistillationEvaluationInput {
  return {
    profileId: 'profile-1',
    schoolId: 'school-1',
    schoolCountry: 'US',
    profile: {
      nationality: 'CN',
      educationSystem: 'AP',
      highSchoolType: 'INTL_CN',
      currentSchoolType: 'INTL_CN',
      isInternational: true,
      gpa: 3.9,
      gpaScale: 4,
      gpaSystem: 'UW',
      testScores: [],
    } as any,
    profileMetrics: {} as any,
    school: {
      acceptanceRate: 12,
      satAvg: 1450,
      sat25: 1400,
      sat75: 1500,
      actAvg: 33,
      act25: 31,
      act75: 34,
    } as any,
    ourProbPrePlatt: 0.18,
    servedProbability: 0.18,
    cohortKey: 'CN__CHINA_INTL',
    applicationRound: 'EA',
    selectivityBand: 'REACH',
    inputSummary: {
      sat: 1520,
      act: null,
      gpaNormalized: 3.9,
      nationality: 'CN',
      curriculumType: 'AP',
      highSchoolType: 'INTL_CN',
      isInternational: true,
    },
    ...overrides,
  };
}

describe('ScorecardTeacherService', () => {
  const service = new ScorecardTeacherService();

  it('uses full score distribution when quartiles exist', async () => {
    const result = await service.evaluate(buildInput());

    expect(result.active).toBe(true);
    expect(result.confidence).toBe('medium');
    expect(result.bucketKey).toContain('sat:');
    expect(result.metadata).toMatchObject({
      schoolAcceptanceRate: 0.12,
    });
  });

  it('falls back to avg-only SAT heuristic when quartiles are missing', async () => {
    const result = await service.evaluate(
      buildInput({
        school: {
          acceptanceRate: 20,
          satAvg: 1300,
          sat25: null,
          sat75: null,
          actAvg: null,
          act25: null,
          act75: null,
        } as any,
        inputSummary: {
          sat: 1540,
          act: null,
          gpaNormalized: 3.9,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    expect(result.active).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.bucketKey).toBe('sat_avg_only:0.75');
    expect(result.probability).toBeCloseTo(0.3, 6);
    expect(result.metadata).toMatchObject({
      schoolAcceptanceRate: 0.2,
    });
  });

  it('returns inactive when there is no test score anchor at all', async () => {
    const result = await service.evaluate(
      buildInput({
        inputSummary: {
          sat: null,
          act: null,
          gpaNormalized: 3.9,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    expect(result.active).toBe(false);
    expect(result.missingReasons).toContain(
      'missing_test_score_or_distribution',
    );
  });
});
