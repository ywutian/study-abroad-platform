import { describe, it, expect } from 'vitest';
import { getDisplayRankings, type SchoolRanking } from './ranking';

describe('getDisplayRankings', () => {
  it('returns empty array for undefined input', () => {
    expect(getDisplayRankings(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getDisplayRankings([])).toEqual([]);
  });

  it('returns single ranking as-is', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 5, year: 2025 },
    ];
    const result = getDisplayRankings(rankings);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(5);
  });

  it('picks best rank per list when multiple entries exist', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 12, year: 2024 },
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 8, year: 2025 },
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 15, year: 2023 },
    ];
    const result = getDisplayRankings(rankings);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(8);
    expect(result[0].year).toBe(2025);
  });

  it('returns multiple lists sorted by rank', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'CS', rank: 3, year: 2025 },
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 10, year: 2025 },
      { source: 'US News', list: 'BUSINESS', rank: 1, year: 2025 },
    ];
    const result = getDisplayRankings(rankings);
    expect(result).toHaveLength(3);
    expect(result[0].list).toBe('BUSINESS');
    expect(result[0].rank).toBe(1);
    expect(result[1].list).toBe('CS');
    expect(result[2].list).toBe('NATIONAL_UNIVERSITY');
  });

  it('handles mixed sources correctly', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 10, year: 2025 },
      { source: 'QS', list: 'NATIONAL_UNIVERSITY', rank: 5, year: 2025 },
    ];
    const result = getDisplayRankings(rankings);
    // Same list key → picks lowest rank regardless of source
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(5);
    expect(result[0].source).toBe('QS');
  });
});
