import {
  deriveCohortKeyFromCase,
  wilsonInterval,
  confidenceTier,
  type CaseCohortInput,
} from './cohort-key';

const emptyCase = (
  overrides: Partial<CaseCohortInput> = {},
): CaseCohortInput => ({
  nationality: null,
  curriculumType: null,
  highSchoolType: null,
  demographicTags: [],
  highSchool: null,
  ...overrides,
});

describe('deriveCohortKeyFromCase', () => {
  it('China applicant in US high school → CN__OVERSEAS_HS', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({ nationality: 'CN', highSchoolType: 'US_HS' }),
      ),
    ).toBe('CN__OVERSEAS_HS');
  });

  it('China applicant in overseas school via HighSchool.country → CN__OVERSEAS_HS', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({
          nationality: 'CHINA',
          highSchool: { country: 'US' },
        }),
      ),
    ).toBe('CN__OVERSEAS_HS');
  });

  it('China applicant in Chinese intl school with AP curriculum → CN__CHINA_INTL', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({
          nationality: 'China',
          curriculumType: 'AP',
          highSchoolType: 'INTERNATIONAL',
        }),
      ),
    ).toBe('CN__CHINA_INTL');
  });

  it('China applicant with IB only (no intl school flag) → CN__CHINA_INTL', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({ nationality: 'PRC', curriculumType: 'IB' }),
      ),
    ).toBe('CN__CHINA_INTL');
  });

  it('China applicant in local HS → CN__CHINA_LOCAL', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({ nationality: 'PRC', curriculumType: 'GAOKAO' }),
      ),
    ).toBe('CN__CHINA_LOCAL');
  });

  it('US applicant → US__US_HS', () => {
    expect(deriveCohortKeyFromCase(emptyCase({ nationality: 'US' }))).toBe(
      'US__US_HS',
    );
  });

  it('non-China non-US applicant in overseas HS → US__OVERSEAS_HS', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({ nationality: 'IN', highSchoolType: 'BOARDING_US' }),
      ),
    ).toBe('US__OVERSEAS_HS');
  });

  it('non-China non-US applicant in home-country HS → OTHER_INTL', () => {
    expect(deriveCohortKeyFromCase(emptyCase({ nationality: 'KR' }))).toBe(
      'OTHER_INTL',
    );
  });

  it('missing nationality but "international" tag → OTHER_INTL', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({ demographicTags: ['international'] }),
      ),
    ).toBe('OTHER_INTL');
  });

  it('missing nationality and no tags → US__US_HS (fallback treats as domestic)', () => {
    // Matches the runtime convention in PredictionPolicyService: when
    // Profile.isInternational is false (or unset), we default to US__US_HS.
    expect(deriveCohortKeyFromCase(emptyCase({}))).toBe('US__US_HS');
  });

  it('case-insensitive nationality strings are normalized', () => {
    expect(
      deriveCohortKeyFromCase(
        emptyCase({ nationality: 'china', curriculumType: 'ap' }),
      ),
    ).toBe('CN__CHINA_INTL');
  });
});

describe('wilsonInterval', () => {
  it('returns [0, 1] for n=0 (no data → unbounded)', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
  });

  it('p=0.5 at n=100 centers near 0.5 with bounded width', () => {
    const { lower, upper } = wilsonInterval(50, 100);
    expect(lower).toBeGreaterThan(0.4);
    expect(lower).toBeLessThan(0.5);
    expect(upper).toBeGreaterThan(0.5);
    expect(upper).toBeLessThan(0.6);
  });

  it('p=0 at n=10: lower bound clamped to 0', () => {
    const { lower } = wilsonInterval(0, 10);
    expect(lower).toBe(0);
  });

  it('p=1 at n=10: upper bound clamped to 1', () => {
    const { upper } = wilsonInterval(10, 10);
    expect(upper).toBe(1);
  });

  it('CI width monotonically shrinks as sample size grows', () => {
    const small = wilsonInterval(5, 10);
    const large = wilsonInterval(50, 100);
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });

  it('p̂=0.5 at n=1000: CI is tight (<6pp wide)', () => {
    const { lower, upper } = wilsonInterval(500, 1000);
    expect(upper - lower).toBeLessThan(0.07);
  });
});

describe('confidenceTier', () => {
  it('n=4 → low', () => expect(confidenceTier(4)).toBe('low'));
  it('n=5 → low (MIN_SAMPLES floor)', () =>
    expect(confidenceTier(5)).toBe('low'));
  it('n=10 → medium', () => expect(confidenceTier(10)).toBe('medium'));
  it('n=29 → medium', () => expect(confidenceTier(29)).toBe('medium'));
  it('n=30 → high', () => expect(confidenceTier(30)).toBe('high'));
});
