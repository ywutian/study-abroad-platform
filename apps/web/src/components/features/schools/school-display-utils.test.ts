import { describe, expect, it } from 'vitest';
import {
  getSchoolCommunityRatingSummary,
  getSchoolEnrollmentCount,
  getSchoolFieldSource,
  getSupplementalCampusLifeGrades,
  hasVerifiedFieldSource,
} from './school-display-utils';

describe('school-display-utils', () => {
  it('prefers totalEnrollment when rendering school size', () => {
    expect(getSchoolEnrollmentCount({ totalEnrollment: 12000, studentCount: 9000 })).toBe(12000);
    expect(getSchoolEnrollmentCount({ studentCount: 9000 })).toBe(9000);
  });

  it('reads verified and supplemental field sources', () => {
    const school = {
      fieldSources: {
        acceptanceRate: {
          tier: 'verified' as const,
          source: 'COLLEGE_SCORECARD',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        usNewsRank: {
          tier: 'supplemental' as const,
          source: 'SEED',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      },
    };

    expect(hasVerifiedFieldSource(school, 'acceptanceRate')).toBe(true);
    expect(hasVerifiedFieldSource(school, 'usNewsRank')).toBe(false);
    expect(getSchoolFieldSource(school, 'usNewsRank')).toEqual({
      tier: 'supplemental',
      source: 'SEED',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
  });

  it('only returns source-backed campus-life grades', () => {
    expect(
      getSupplementalCampusLifeGrades({
        nicheOverallGrade: 'A',
        nicheSafetyGrade: 'A+',
        nicheLifeGrade: 'B+',
        nicheFoodGrade: 'A-',
        fieldSources: {
          nicheOverallGrade: {
            tier: 'supplemental',
            source: 'APPILY',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
          nicheSafetyGrade: {
            tier: 'supplemental',
            source: 'APPILY',
            updatedAt: '2026-04-02T00:00:00.000Z',
          },
        },
      })
    ).toEqual({
      overallGrade: 'A',
      safetyGrade: 'A+',
      lifeGrade: undefined,
      foodGrade: undefined,
      hasGrades: true,
    });
  });

  it('returns an empty community summary when none is present', () => {
    expect(getSchoolCommunityRatingSummary({})).toEqual({
      count: 0,
      safetyAvg: null,
      lifeAvg: null,
      foodAvg: null,
      isPublic: false,
    });
  });
});
