import { parseCollegeVineHubChancesPayload } from './collegevine-hub-data';

describe('parseCollegeVineHubChancesPayload', () => {
  it('parses initialSchools + chancesAndFinancials keyed by id', () => {
    const payload = {
      initialSchools: {
        schools: [
          { id: 42, name: 'Columbia University', slug: 'columbia-university' },
          { id: 7, name: 'MIT', slug: 'massachusetts-institute-of-technology' },
        ],
        chancesAndFinancials: {
          '42': { admissionChancePercent: 8, tier: 'REACH' },
          '7': { chance: 0.04, tier: 'REACH' },
        },
      },
    };

    const rows = parseCollegeVineHubChancesPayload(payload);
    expect(rows).toHaveLength(2);
    const col = rows.find((r) => r.schoolKey === 'cv-columbia-university');
    expect(col?.rawName).toBe('Columbia University');
    expect(col?.probability).toBeCloseTo(0.08, 5);
    expect(col?.tierLabel).toBe('REACH');
    const mit = rows.find(
      (r) => r.schoolKey === 'cv-massachusetts-institute-of-technology',
    );
    expect(mit?.probability).toBeCloseTo(0.04, 5);
  });

  it('parses top-level schools with inline chance fields', () => {
    const payload = {
      schools: [{ id: 'x1', name: 'Boston University', chance: 55 }],
    };
    const rows = parseCollegeVineHubChancesPayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].schoolKey).toBe('cv-x1');
    expect(rows[0].probability).toBeCloseTo(0.55, 5);
  });

  it('parses chances-only map with embedded names', () => {
    const payload = {
      chancesAndFinancials: {
        '100': {
          name: 'NYU',
          schoolName: 'New York University',
          probability: 0.22,
        },
      },
    };
    const rows = parseCollegeVineHubChancesPayload(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].rawName).toBe('New York University');
    expect(rows[0].probability).toBeCloseTo(0.22, 5);
  });
});
