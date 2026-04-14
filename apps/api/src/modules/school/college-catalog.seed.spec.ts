import {
  buildUnifiedCollegeCatalog,
  mergeSeedSchoolData,
} from '../../../scripts/lib/college-catalog';
import {
  SeedSchoolData,
  withDefaultSeedMetadata,
} from '../../../scripts/lib/seed-helpers';

describe('college catalog seed composition', () => {
  it('keeps official base fields while filling richer descriptions', () => {
    const baseSchools: SeedSchoolData[] = [
      {
        name: 'Massachusetts Institute of Technology',
        nameZh: '麻省理工学院',
        state: 'MA',
        city: 'Cambridge',
        usNewsRank: 2,
        acceptanceRate: 4,
        tuition: 60156,
        avgSalary: 115000,
        scorecardId: '166683',
        ipedsId: '166683',
        website: 'https://www.mit.edu',
      },
    ];

    const catalog = buildUnifiedCollegeCatalog(baseSchools);
    const mit = catalog.find(
      (school) => school.name === 'Massachusetts Institute of Technology',
    );
    const williams = catalog.find(
      (school) => school.name === 'Williams College',
    );

    expect(mit).toBeDefined();
    expect(mit?.scorecardId).toBe('166683');
    expect(mit?.ipedsId).toBe('166683');
    expect(mit?.description).toContain('world-leading research university');
    expect(mit?.aliases).toEqual(expect.arrayContaining(['MIT', '麻省理工']));
    expect(mit?.needBlindInternational).toBe(true);
    expect(mit?.intlAcceptanceRate).toBe(10);
    expect(mit?.intlStudentPct).toBe(11);
    expect(mit?.metadata).toMatchObject({ lastRankingUpdate: '2025' });
    expect(williams).toBeDefined();
    expect(catalog.length).toBeGreaterThan(200);
  });

  it('deep merges metadata without dropping existing provenance', () => {
    const merged = mergeSeedSchoolData(
      {
        name: 'Example University',
        metadata: {
          provenance: {
            acceptanceRate: {
              tier: 'OFFICIAL',
              source: 'COLLEGE_SCORECARD',
              fetchedAt: '2026-04-01T00:00:00.000Z',
            },
          },
          requirements: { toeflMin: 100 },
        },
      },
      {
        name: 'Example University',
        metadata: {
          deadlines: { rd: 'Jan 1' },
          provenance: {
            essayCount: {
              tier: 'INFERRED',
              source: 'SEED',
              fetchedAt: '2026-04-02T00:00:00.000Z',
            },
          },
        },
      },
    );

    expect(merged.metadata).toEqual({
      provenance: {
        acceptanceRate: {
          tier: 'OFFICIAL',
          source: 'COLLEGE_SCORECARD',
          fetchedAt: '2026-04-01T00:00:00.000Z',
        },
        essayCount: {
          tier: 'INFERRED',
          source: 'SEED',
          fetchedAt: '2026-04-02T00:00:00.000Z',
        },
      },
      requirements: { toeflMin: 100 },
      deadlines: { rd: 'Jan 1' },
    });
  });

  it('matches curated enrichment keys against normalized school names', () => {
    const catalog = buildUnifiedCollegeCatalog([]);
    const michigan = catalog.find(
      (school) => school.name === 'University of Michigan, Ann Arbor',
    );

    expect(michigan).toBeDefined();
    expect(michigan?.intlStudentPct).toBe(7);
  });

  it('adds official provenance defaults without promoting seed-only fields', () => {
    const metadata = withDefaultSeedMetadata(
      {
        name: 'Harvard University',
        acceptanceRate: 3.4,
        tuition: 59076,
        avgSalary: 95000,
        totalEnrollment: 30631,
        description: 'A private research university.',
        metadata: {
          essayCount: 5,
          provenance: {
            essayCount: {
              tier: 'INFERRED',
              source: 'SEED',
              fetchedAt: '2026-03-25T00:00:00.000Z',
            },
          },
        },
      },
      '2026-04-12T00:00:00.000Z',
    ) as Record<string, any>;

    expect(metadata.provenance.acceptanceRate).toEqual({
      tier: 'OFFICIAL',
      source: 'COLLEGE_SCORECARD',
      fetchedAt: '2026-04-12T00:00:00.000Z',
    });
    expect(metadata.provenance.avgSalary).toEqual({
      tier: 'OFFICIAL',
      source: 'COLLEGE_SCORECARD',
      fetchedAt: '2026-04-12T00:00:00.000Z',
    });
    expect(metadata.provenance.totalEnrollment).toEqual({
      tier: 'OFFICIAL',
      source: 'COLLEGE_SCORECARD',
      fetchedAt: '2026-04-12T00:00:00.000Z',
    });
    expect(metadata.provenance.tuition).toEqual({
      tier: 'OFFICIAL',
      source: 'IPEDS',
      fetchedAt: '2026-04-12T00:00:00.000Z',
    });
    expect(metadata.provenance.description).toEqual({
      tier: 'SEED',
      source: 'SEED',
      fetchedAt: '2026-04-12T00:00:00.000Z',
    });
    expect(metadata.provenance.essayCount).toEqual({
      tier: 'INFERRED',
      source: 'SEED',
      fetchedAt: '2026-03-25T00:00:00.000Z',
    });
  });
});
