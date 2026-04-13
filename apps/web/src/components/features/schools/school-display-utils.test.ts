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

  it('reads trust-tier field sources', () => {
    const school = {
      fieldSources: {
        acceptanceRate: {
          tier: 'OFFICIAL' as const,
          source: 'COLLEGE_SCORECARD',
          fetchedAt: '2026-04-01T00:00:00.000Z',
          staleness: 'FRESH' as const,
          isVerified: true,
          predictionEligible: true,
        },
        usNewsRank: {
          tier: 'SEED' as const,
          source: 'SEED',
          fetchedAt: '2026-04-01T00:00:00.000Z',
          staleness: 'FRESH' as const,
          isVerified: false,
          predictionEligible: true,
        },
      },
    };

    expect(hasVerifiedFieldSource(school, 'acceptanceRate')).toBe(true);
    expect(hasVerifiedFieldSource(school, 'usNewsRank')).toBe(true);
    expect(getSchoolFieldSource(school, 'usNewsRank')).toEqual({
      tier: 'SEED',
      source: 'SEED',
      fetchedAt: '2026-04-01T00:00:00.000Z',
      staleness: 'FRESH',
      isVerified: false,
      predictionEligible: true,
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
            tier: 'SCRAPED',
            source: 'APPILY',
            fetchedAt: '2026-04-02T00:00:00.000Z',
            staleness: 'FRESH' as const,
            isVerified: false,
            predictionEligible: true,
          },
          nicheSafetyGrade: {
            tier: 'SCRAPED',
            source: 'APPILY',
            fetchedAt: '2026-04-02T00:00:00.000Z',
            staleness: 'FRESH' as const,
            isVerified: false,
            predictionEligible: true,
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
