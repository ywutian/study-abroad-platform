import { describe, it, expect } from 'vitest';
import { getDisplayRankings, getRankingSourceLabel, type SchoolRanking } from './ranking';

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

  it('returns multiple lists sorted by comparable display priority before rank', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'CS', rank: 3, year: 2025 },
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 10, year: 2025 },
      { source: 'US News', list: 'BUSINESS', rank: 1, year: 2025 },
    ];
    const result = getDisplayRankings(rankings);
    expect(result).toHaveLength(3);
    expect(result[0].list).toBe('NATIONAL_UNIVERSITY');
    expect(result[1].list).toBe('BUSINESS');
    expect(result[2].list).toBe('CS');
  });

  it('keeps mixed sources separate for the same list', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 10, year: 2025 },
      { source: 'QS', list: 'NATIONAL_UNIVERSITY', rank: 5, year: 2025 },
    ];
    const result = getDisplayRankings(rankings);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.source)).toEqual(['QS', 'US_NEWS']);
  });

  it('normalizes machine source labels for display', () => {
    expect(getRankingSourceLabel('US_NEWS')).toBe('US News');
    expect(getRankingSourceLabel('QS')).toBe('QS');
  });

  it('prioritizes the selected concrete ranking list for display', () => {
    const rankings: SchoolRanking[] = [
      { source: 'US News', list: 'NATIONAL_UNIVERSITY', rank: 40, year: 2025 },
      { source: 'US News', list: 'MUSIC', rank: 1, year: 2025 },
    ];

    const result = getDisplayRankings(rankings, 'MUSIC');

    expect(result[0].list).toBe('MUSIC');
  });
});
