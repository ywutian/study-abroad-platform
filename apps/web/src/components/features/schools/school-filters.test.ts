import { describe, expect, it } from 'vitest';
import {
  applyTuitionPreset,
  buildSchoolQueryParams,
  countActiveSchoolFilters,
  getTuitionPresetValue,
  SCHOOL_BROWSE_PAGE_SIZE,
  sanitizeSchoolFilters,
  type SchoolFilters,
} from './school-filters';

describe('school-filters', () => {
  it('serializes the supported API params from one filter source', () => {
    const params = buildSchoolQueryParams({
      search: '  mit  ',
      country: 'US',
      filters: {
        schoolType: 'private',
        testOptional: true,
        needBlind: true,
        hasEarlyDecision: true,
        rankMax: 20,
        acceptanceMax: 15,
        tuitionMin: 5,
        salaryMin: 8,
      },
      sortBy: 'weighted',
      weights: {
        ranking: 30,
        acceptanceRate: 20,
        tuition: 25,
        salary: 25,
      },
    });

    expect(params).toMatchObject({
      pageSize: String(SCHOOL_BROWSE_PAGE_SIZE),
      search: 'mit',
      country: 'US',
      schoolType: 'private',
      testOptional: 'true',
      needBlind: 'true',
      hasEarlyDecision: 'true',
      rankMax: '20',
      acceptanceMax: '15',
      tuitionMin: '50000',
      salaryMin: '80000',
      sortBy: 'weighted',
      rankingSource: 'US_NEWS',
      rankingList: 'US_NEWS_CORE',
      weightRank: '30',
      weightAcceptance: '20',
      weightTuition: '25',
      weightSalary: '25',
      weightCampusSafety: '0',
      weightCampusLife: '0',
      weightCampusFood: '0',
    });
    expect(params).not.toHaveProperty('isPrivate');
  });

  it('serializes a selected US News ranking list', () => {
    const params = buildSchoolQueryParams({
      rankingList: 'MUSIC',
      sortBy: 'rank',
    });

    expect(params).toMatchObject({
      rankingSource: 'US_NEWS',
      rankingList: 'MUSIC',
      sortBy: 'rank',
    });
  });

  it('drops US-only location filters when country is not US', () => {
    const filters: SchoolFilters = { state: 'CA', region: 'west' };

    expect(sanitizeSchoolFilters(filters, 'UK')).toEqual({
      state: undefined,
      region: undefined,
      schoolType: undefined,
      testOptional: undefined,
      needBlind: undefined,
      hasEarlyDecision: undefined,
      rankMin: undefined,
      rankMax: undefined,
      acceptanceMin: undefined,
      acceptanceMax: undefined,
      tuitionMin: undefined,
      tuitionMax: undefined,
      sizeMin: undefined,
      sizeMax: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
      minSafetyGrade: undefined,
      minLifeGrade: undefined,
      minFoodGrade: undefined,
    });
  });

  it('lets state override region for US filters', () => {
    const params = buildSchoolQueryParams({
      country: 'US',
      filters: { state: 'CA', region: 'west' },
    });

    expect(params.state).toBe('CA');
    expect(params.region).toBeUndefined();
  });

  it('supports tuition presets and custom ranges from the same state', () => {
    expect(getTuitionPresetValue(applyTuitionPreset({}, '20-30'))).toBe('20-30');
    expect(getTuitionPresetValue({ tuitionMin: 2.5, tuitionMax: 4.5 })).toBe('CUSTOM');
  });

  it('counts only active filters after default-range cleanup', () => {
    expect(
      countActiveSchoolFilters(
        {
          rankMin: 1,
          rankMax: 100,
          acceptanceMin: 0,
          acceptanceMax: 100,
          schoolType: 'public',
        },
        'US'
      )
    ).toBe(1);
  });

  it('keeps active filter counting aligned with serialized query params', () => {
    const filters: SchoolFilters = {
      state: 'CA',
      schoolType: 'private',
      tuitionMin: 4,
      tuitionMax: 6,
      salaryMax: 12,
      testOptional: true,
    };

    const params = buildSchoolQueryParams({
      country: 'US',
      filters,
    });

    expect(countActiveSchoolFilters(filters, 'US')).toBe(5);
    expect(params).toMatchObject({
      pageSize: String(SCHOOL_BROWSE_PAGE_SIZE),
      state: 'CA',
      schoolType: 'private',
      tuitionMin: '40000',
      tuitionMax: '60000',
      salaryMax: '120000',
      testOptional: 'true',
    });
  });

  it('serializes URL-safe campus-life grade filters', () => {
    const filters: SchoolFilters = {
      minSafetyGrade: 'A_MINUS',
      minLifeGrade: 'B_PLUS',
      minFoodGrade: 'B',
    };

    const params = buildSchoolQueryParams({
      country: 'US',
      filters,
      weights: {
        ranking: 20,
        acceptanceRate: 20,
        tuition: 20,
        salary: 20,
        campusSafety: 15,
        campusLife: 10,
        campusFood: 15,
      },
    });

    expect(countActiveSchoolFilters(filters, 'US')).toBe(3);
    expect(params).toMatchObject({
      minSafetyGrade: 'A_MINUS',
      minLifeGrade: 'B_PLUS',
      minFoodGrade: 'B',
      weightCampusSafety: '15',
      weightCampusLife: '10',
      weightCampusFood: '15',
    });
  });
});
