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
      gpaNormalized: 0.95,
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
      scorecardVersion: 2,
    });
    expect((result.metadata?.axes as any[]).map((axis) => axis.axis)).toEqual([
      'sat',
      'gpa',
    ]);
  });

  it('does not use avg-only SAT heuristic when quartiles are missing', async () => {
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
          gpaNormalized: null,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    expect(result.active).toBe(false);
    expect(result.probability).toBeNull();
    expect(result.missingReasons).toContain(
      'missing_test_score_or_distribution',
    );
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
          gpaNormalized: null,
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

  it('uses a low-confidence GPA axis at the expected selectivity GPA', async () => {
    const result = await service.evaluate(
      buildInput({
        inputSummary: {
          sat: null,
          act: null,
          gpaNormalized: 0.95,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    expect(result.active).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.bucketKey).toBe('gpa:0.50');
    expect(result.probability).toBeCloseTo(0.12, 6);
    expect(result.metadata).toMatchObject({
      schoolAcceptanceRate: 0.12,
      scorecardVersion: 2,
    });
    const axis = (result.metadata?.axes as any[])[0];
    expect(axis).toMatchObject({
      axis: 'gpa',
      confidence: 'low',
      mode: 'heuristic_gpa',
    });
    expect(axis.percentile).toBeCloseTo(0.5, 6);
    expect(axis.multiplier).toBeCloseTo(1, 6);
  });

  it('rewards GPA one sigma above the expected selectivity GPA', async () => {
    const result = await service.evaluate(
      buildInput({
        inputSummary: {
          sat: null,
          act: null,
          gpaNormalized: 0.99,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    const axis = (result.metadata?.axes as any[])[0];
    expect(result.active).toBe(true);
    expect(axis.axis).toBe('gpa');
    expect(axis.percentile).toBeCloseTo(0.8413, 3);
    expect(axis.multiplier).toBeCloseTo(1.6826, 3);
    expect(result.probability).toBeCloseTo(0.2019, 3);
  });

  it('penalizes GPA one sigma below the expected selectivity GPA', async () => {
    const result = await service.evaluate(
      buildInput({
        inputSummary: {
          sat: null,
          act: null,
          gpaNormalized: 0.91,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    const axis = (result.metadata?.axes as any[])[0];
    expect(result.active).toBe(true);
    expect(axis.axis).toBe('gpa');
    expect(axis.percentile).toBeCloseTo(0.1587, 3);
    expect(axis.multiplier).toBeCloseTo(0.3174, 3);
    expect(result.probability).toBeCloseTo(0.0381, 3);
  });

  it('averages SAT, ACT, and GPA axes when all are present', async () => {
    const result = await service.evaluate(
      buildInput({
        inputSummary: {
          sat: 1520,
          act: 35,
          gpaNormalized: 0.99,
          nationality: 'CN',
          curriculumType: 'AP',
          highSchoolType: 'INTL_CN',
          isInternational: true,
        },
      }),
    );

    const axes = result.metadata?.axes as any[];
    const expectedProbability =
      axes.reduce((sum, axis) => sum + axis.probability, 0) / axes.length;

    expect(result.active).toBe(true);
    expect(result.confidence).toBe('high');
    expect(axes.map((axis) => axis.axis)).toEqual(['sat', 'act', 'gpa']);
    expect(result.probability).toBeCloseTo(expectedProbability, 6);
  });
});
