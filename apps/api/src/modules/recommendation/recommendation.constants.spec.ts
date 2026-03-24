import { Prisma } from '@prisma/client';
import { mapSchoolMeta } from './recommendation.constants';

// Minimal mock matching RecommendationSchoolResult shape
function buildMockSchool(overrides: Record<string, unknown> = {}) {
  return {
    id: 'school-1',
    name: 'MIT',
    nameZh: '麻省理工',
    aliases: ['Massachusetts Institute of Technology'],
    usNewsRank: 1,
    acceptanceRate: new Prisma.Decimal(4.0),
    city: 'Cambridge',
    state: 'MA',
    tuition: 55000,
    isPrivate: true,
    testOptional: true,
    hasEarlyDecision: true,
    retentionRate: new Prisma.Decimal(98.5),
    logoUrl: 'https://img.logo.dev/mit.edu',
    website: 'https://mit.edu',
    scorecardId: null,
    ipedsId: null,
    transferAcceptanceRate: null,
    rankings: [],
    ...overrides,
  } as any;
}

describe('mapSchoolMeta', () => {
  it('should map all fields from a complete school record', () => {
    const result = mapSchoolMeta(buildMockSchool());

    expect(result.nameZh).toBe('麻省理工');
    expect(result.usNewsRank).toBe(1);
    expect(result.acceptanceRate).toBe(4);
    expect(result.city).toBe('Cambridge');
    expect(result.state).toBe('MA');
    expect(result.tuition).toBe(55000);
    expect(result.isPrivate).toBe(true);
    expect(result.testOptional).toBe(true);
    expect(result.hasEarlyDecision).toBe(true);
    expect(result.retentionRate).toBe(98.5);
    expect(result.logoUrl).toBe('https://img.logo.dev/mit.edu');
    expect(result.website).toBe('https://mit.edu');
  });

  it('should return undefined for null/empty logoUrl and website', () => {
    const result = mapSchoolMeta(
      buildMockSchool({ logoUrl: null, website: '' }),
    );

    expect(result.logoUrl).toBeUndefined();
    expect(result.website).toBeUndefined();
  });

  it('should return undefined for null testOptional and hasEarlyDecision', () => {
    const result = mapSchoolMeta(
      buildMockSchool({ testOptional: null, hasEarlyDecision: null }),
    );

    expect(result.testOptional).toBeUndefined();
    expect(result.hasEarlyDecision).toBeUndefined();
  });

  it('should convert Decimal retentionRate to number', () => {
    const result = mapSchoolMeta(
      buildMockSchool({ retentionRate: new Prisma.Decimal(92.3) }),
    );

    expect(result.retentionRate).toBe(92.3);
    expect(typeof result.retentionRate).toBe('number');
  });

  it('should return undefined for null retentionRate', () => {
    const result = mapSchoolMeta(buildMockSchool({ retentionRate: null }));

    expect(result.retentionRate).toBeUndefined();
  });

  it('should clamp acceptanceRate via clampPercentRate', () => {
    // Prisma Decimal with reasonable percentage
    const result = mapSchoolMeta(
      buildMockSchool({ acceptanceRate: new Prisma.Decimal(15.5) }),
    );

    expect(result.acceptanceRate).toBe(15.5);
  });

  it('should handle null acceptanceRate', () => {
    const result = mapSchoolMeta(buildMockSchool({ acceptanceRate: null }));

    expect(result.acceptanceRate).toBeUndefined();
  });

  // ============================================
  // sourceUrls
  // ============================================

  describe('sourceUrls', () => {
    it('should return undefined URLs when scorecardId and ipedsId are null', () => {
      const result = mapSchoolMeta(
        buildMockSchool({ scorecardId: null, ipedsId: null, website: '' }),
      );

      expect(result.sourceUrls.collegeScorecardUrl).toBeUndefined();
      expect(result.sourceUrls.ipedsUrl).toBeUndefined();
      expect(result.sourceUrls.websiteUrl).toBeUndefined();
    });

    it('should build College Scorecard URL when scorecardId exists', () => {
      const result = mapSchoolMeta(buildMockSchool({ scorecardId: '166683' }));

      expect(result.sourceUrls.collegeScorecardUrl).toBe(
        'https://collegescorecard.ed.gov/school/?166683',
      );
    });

    it('should build IPEDS URL when ipedsId exists', () => {
      const result = mapSchoolMeta(buildMockSchool({ ipedsId: '166683' }));

      expect(result.sourceUrls.ipedsUrl).toBe(
        'https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=166683',
      );
    });

    it('should include website URL when website is present', () => {
      const result = mapSchoolMeta(
        buildMockSchool({ website: 'https://mit.edu' }),
      );

      expect(result.sourceUrls.websiteUrl).toBe('https://mit.edu');
    });

    it('should return undefined websiteUrl when website is empty string', () => {
      const result = mapSchoolMeta(buildMockSchool({ website: '' }));

      expect(result.sourceUrls.websiteUrl).toBeUndefined();
    });

    it('should build all source URLs when all IDs are present', () => {
      const result = mapSchoolMeta(
        buildMockSchool({
          scorecardId: '111111',
          ipedsId: '222222',
          website: 'https://example.edu',
        }),
      );

      expect(result.sourceUrls.collegeScorecardUrl).toBe(
        'https://collegescorecard.ed.gov/school/?111111',
      );
      expect(result.sourceUrls.ipedsUrl).toBe(
        'https://nces.ed.gov/ipeds/datacenter/institutionprofile.aspx?unitId=222222',
      );
      expect(result.sourceUrls.websiteUrl).toBe('https://example.edu');
    });
  });
});
