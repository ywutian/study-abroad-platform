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
    });
    expect(params).not.toHaveProperty('isPrivate');
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
      testOptional: true,
    };

    const params = buildSchoolQueryParams({
      country: 'US',
      filters,
    });

    expect(countActiveSchoolFilters(filters, 'US')).toBe(4);
    expect(params).toMatchObject({
      pageSize: String(SCHOOL_BROWSE_PAGE_SIZE),
      state: 'CA',
      schoolType: 'private',
      tuitionMin: '40000',
      tuitionMax: '60000',
      testOptional: 'true',
    });
  });
});
