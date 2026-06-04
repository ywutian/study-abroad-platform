import { toSchoolListItem, SCHOOL_LIST_ITEM_KEYS } from './school.constants';

describe('toSchoolListItem', () => {
  it('keeps list-card fields and drops heavy/detail-only ones', () => {
    const full = {
      id: '1',
      name: 'MIT',
      nameZh: '麻省理工',
      city: 'Cambridge',
      state: 'MA',
      country: 'US',
      website: 'mit.edu',
      acceptanceRate: 4.6,
      transferAcceptanceRate: 5,
      usNewsRank: 2,
      logoUrl: 'x',
      testingPolicy: 'OPTIONAL',
      testOptional: true,
      tuition: 50000,
      media: { hero: 'a' },
      rankings: [{ source: 'usnews', rank: 2 }],
      communityRatingSummary: { count: 0 },
      // heavy / detail-only — must be dropped from the list payload:
      fieldSources: { name: { tier: 'OFFICIAL' } },
      metadata: { raw: 'lots of bytes' },
      gpaDistribution: {},
      description: 'A long description not shown in list cards',
    };

    const slim = toSchoolListItem(full);

    // kept
    expect(slim.id).toBe('1');
    expect(slim.name).toBe('MIT');
    expect(slim.rankings).toEqual([{ source: 'usnews', rank: 2 }]);
    expect(slim.media).toEqual({ hero: 'a' });
    expect(slim.communityRatingSummary).toBeDefined();

    // dropped
    expect('fieldSources' in slim).toBe(false);
    expect('metadata' in slim).toBe(false);
    expect('gpaDistribution' in slim).toBe(false);
    expect('description' in slim).toBe(false);

    // only allowlisted keys present
    expect(Object.keys(slim).sort()).toEqual(
      SCHOOL_LIST_ITEM_KEYS.filter((k) => k in full).sort(),
    );
  });

  it('skips keys that are absent on the source object', () => {
    const slim = toSchoolListItem({ id: '1', name: 'X' });
    expect(Object.keys(slim).sort()).toEqual(['id', 'name']);
  });
});
