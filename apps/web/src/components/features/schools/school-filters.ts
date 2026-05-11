export interface SchoolFilters {
  state?: string;
  rankMin?: number;
  rankMax?: number;
  acceptanceMin?: number;
  acceptanceMax?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  testOptional?: boolean;
  needBlind?: boolean;
  hasEarlyDecision?: boolean;
  schoolType?: 'public' | 'private';
  region?: string;
}

export type SchoolSortBy = 'rank' | 'name' | 'acceptance' | 'salary' | 'weighted';
export type SchoolRankingSource = 'US_NEWS';
export type SchoolRankingList =
  | 'US_NEWS_CORE'
  | 'NATIONAL_UNIVERSITY'
  | 'LIBERAL_ARTS'
  | 'REGIONAL_UNIVERSITY'
  | 'ART_DESIGN'
  | 'MUSIC'
  | 'ENGINEERING_NO_PHD';

export const SCHOOL_DEFAULT_RANKING_SOURCE: SchoolRankingSource = 'US_NEWS';
export const SCHOOL_DEFAULT_RANKING_LIST: SchoolRankingList = 'US_NEWS_CORE';

export interface SchoolWeightParams {
  ranking: number;
  acceptanceRate: number;
  tuition: number;
  salary: number;
}

export type TuitionPresetValue = 'ALL' | '20-30' | '30-40' | '40-50' | '50+' | 'CUSTOM';

export const SCHOOL_BROWSE_PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
export const SCHOOL_BROWSE_DEFAULT_PAGE_SIZE = 24;
/**
 * @deprecated Use SCHOOL_BROWSE_DEFAULT_PAGE_SIZE; kept for backwards compatibility.
 */
export const SCHOOL_BROWSE_PAGE_SIZE = SCHOOL_BROWSE_DEFAULT_PAGE_SIZE;

export const SCHOOL_FILTER_DEFAULTS = {
  rankMin: 1,
  rankMax: 100,
  acceptanceMin: 0,
  acceptanceMax: 100,
  tuitionMin: 0,
  tuitionMax: 8,
  sizeMin: 0,
  sizeMax: 50000,
  salaryMin: 0,
  salaryMax: 20,
} as const;

function normalizeBound(value: number | undefined, defaultValue: number): number | undefined {
  return value == null || value === defaultValue ? undefined : value;
}

export function sanitizeSchoolFilters(
  filters: SchoolFilters,
  country?: string | null
): SchoolFilters {
  const sanitized: SchoolFilters = {
    ...filters,
    schoolType:
      filters.schoolType === 'public' || filters.schoolType === 'private'
        ? filters.schoolType
        : undefined,
    testOptional: filters.testOptional || undefined,
    needBlind: filters.needBlind || undefined,
    hasEarlyDecision: filters.hasEarlyDecision || undefined,
  };

  sanitized.rankMin = normalizeBound(filters.rankMin, SCHOOL_FILTER_DEFAULTS.rankMin);
  sanitized.rankMax = normalizeBound(filters.rankMax, SCHOOL_FILTER_DEFAULTS.rankMax);
  sanitized.acceptanceMin = normalizeBound(
    filters.acceptanceMin,
    SCHOOL_FILTER_DEFAULTS.acceptanceMin
  );
  sanitized.acceptanceMax = normalizeBound(
    filters.acceptanceMax,
    SCHOOL_FILTER_DEFAULTS.acceptanceMax
  );
  sanitized.tuitionMin = normalizeBound(filters.tuitionMin, SCHOOL_FILTER_DEFAULTS.tuitionMin);
  sanitized.tuitionMax = normalizeBound(filters.tuitionMax, SCHOOL_FILTER_DEFAULTS.tuitionMax);
  sanitized.sizeMin = normalizeBound(filters.sizeMin, SCHOOL_FILTER_DEFAULTS.sizeMin);
  sanitized.sizeMax = normalizeBound(filters.sizeMax, SCHOOL_FILTER_DEFAULTS.sizeMax);
  sanitized.salaryMin = normalizeBound(filters.salaryMin, SCHOOL_FILTER_DEFAULTS.salaryMin);
  sanitized.salaryMax = normalizeBound(filters.salaryMax, SCHOOL_FILTER_DEFAULTS.salaryMax);

  if (country && country !== 'US') {
    sanitized.state = undefined;
    sanitized.region = undefined;
  } else if (sanitized.state) {
    sanitized.region = undefined;
  }

  return sanitized;
}

export function countActiveSchoolFilters(filters: SchoolFilters, country?: string | null): number {
  const sanitized = sanitizeSchoolFilters(filters, country);
  let count = 0;

  if (sanitized.state || sanitized.region) count++;
  if (sanitized.rankMin != null || sanitized.rankMax != null) count++;
  if (sanitized.acceptanceMin != null || sanitized.acceptanceMax != null) count++;
  if (sanitized.tuitionMin != null || sanitized.tuitionMax != null) count++;
  if (sanitized.sizeMin != null || sanitized.sizeMax != null) count++;
  if (sanitized.salaryMin != null || sanitized.salaryMax != null) count++;
  if (sanitized.schoolType) count++;
  if (sanitized.testOptional) count++;
  if (sanitized.needBlind) count++;
  if (sanitized.hasEarlyDecision) count++;

  return count;
}

export function buildSchoolQueryParams(input: {
  search?: string;
  country?: string;
  filters?: SchoolFilters;
  page?: number;
  pageSize?: number;
  sortBy?: SchoolSortBy;
  rankingSource?: SchoolRankingSource;
  rankingList?: SchoolRankingList;
  weights?: SchoolWeightParams;
}): Record<string, string> {
  const params: Record<string, string> = {
    pageSize: String(input.pageSize ?? SCHOOL_BROWSE_DEFAULT_PAGE_SIZE),
  };
  if (input.page && input.page > 1) {
    params.page = String(input.page);
  }
  const search = input.search?.trim();
  const country = input.country && input.country !== 'ALL' ? input.country : undefined;
  const filters = sanitizeSchoolFilters(input.filters ?? {}, country);

  if (search) {
    params.search = search;
  }
  if (country) {
    params.country = country;
  }
  if (filters.state) {
    params.state = filters.state;
  }
  if (filters.region) {
    params.region = filters.region;
  }
  if (filters.rankMin != null) {
    params.rankMin = String(filters.rankMin);
  }
  if (filters.rankMax != null) {
    params.rankMax = String(filters.rankMax);
  }
  if (filters.acceptanceMin != null) {
    params.acceptanceMin = String(filters.acceptanceMin);
  }
  if (filters.acceptanceMax != null) {
    params.acceptanceMax = String(filters.acceptanceMax);
  }
  if (filters.tuitionMin != null) {
    params.tuitionMin = String(filters.tuitionMin * 10000);
  }
  if (filters.tuitionMax != null) {
    params.tuitionMax = String(filters.tuitionMax * 10000);
  }
  if (filters.sizeMin != null) {
    params.sizeMin = String(filters.sizeMin);
  }
  if (filters.sizeMax != null) {
    params.sizeMax = String(filters.sizeMax);
  }
  if (filters.salaryMin != null) {
    params.salaryMin = String(filters.salaryMin * 10000);
  }
  if (filters.salaryMax != null) {
    params.salaryMax = String(filters.salaryMax * 10000);
  }
  if (filters.schoolType) {
    params.schoolType = filters.schoolType;
  }
  if (filters.testOptional) {
    params.testOptional = 'true';
  }
  if (filters.needBlind) {
    params.needBlind = 'true';
  }
  if (filters.hasEarlyDecision) {
    params.hasEarlyDecision = 'true';
  }
  if (input.sortBy) {
    params.sortBy = input.sortBy;
  }
  params.rankingSource = input.rankingSource ?? SCHOOL_DEFAULT_RANKING_SOURCE;
  params.rankingList = input.rankingList ?? SCHOOL_DEFAULT_RANKING_LIST;
  if (input.weights) {
    params.weightRank = String(input.weights.ranking);
    params.weightAcceptance = String(input.weights.acceptanceRate);
    params.weightTuition = String(input.weights.tuition);
    params.weightSalary = String(input.weights.salary);
  }

  return params;
}

export function applyTuitionPreset(
  filters: SchoolFilters,
  preset: Exclude<TuitionPresetValue, 'CUSTOM'>
): SchoolFilters {
  const next: SchoolFilters = { ...filters };

  switch (preset) {
    case 'ALL':
      next.tuitionMin = undefined;
      next.tuitionMax = undefined;
      return next;
    case '20-30':
      next.tuitionMin = 2;
      next.tuitionMax = 3;
      return next;
    case '30-40':
      next.tuitionMin = 3;
      next.tuitionMax = 4;
      return next;
    case '40-50':
      next.tuitionMin = 4;
      next.tuitionMax = 5;
      return next;
    case '50+':
      next.tuitionMin = 5;
      next.tuitionMax = undefined;
      return next;
  }
}

export function getTuitionPresetValue(filters: SchoolFilters): TuitionPresetValue {
  const sanitized = sanitizeSchoolFilters(filters, 'US');

  if (sanitized.tuitionMin == null && sanitized.tuitionMax == null) {
    return 'ALL';
  }
  if (sanitized.tuitionMin === 2 && sanitized.tuitionMax === 3) {
    return '20-30';
  }
  if (sanitized.tuitionMin === 3 && sanitized.tuitionMax === 4) {
    return '30-40';
  }
  if (sanitized.tuitionMin === 4 && sanitized.tuitionMax === 5) {
    return '40-50';
  }
  if (sanitized.tuitionMin === 5 && sanitized.tuitionMax == null) {
    return '50+';
  }

  return 'CUSTOM';
}
