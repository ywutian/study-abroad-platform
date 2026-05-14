import { Test, type TestingModule } from '@nestjs/testing';
import { AdminSchoolDataCoverageService } from './admin-school-data-coverage.service';
import { AdminSchoolDataHealthService } from './admin-school-data-health.service';

/**
 * Coverage for the priority-ranking logic. We mock the underlying coverage
 * service so this spec stays independent of Prisma / provenance internals.
 */
describe('AdminSchoolDataHealthService', () => {
  let service: AdminSchoolDataHealthService;
  let coverage: { getCoverage: jest.Mock };

  // Build a coverage `item` shaped like AdminSchoolDataCoverageService output.
  // We only fill the fields the health service actually consumes.
  const buildItem = (overrides: {
    schoolId: string;
    schoolName: string;
    usNewsRank: number | null;
    fields: Array<{
      field: string;
      filled?: boolean;
      isOfficial?: boolean;
      isHeuristic?: boolean;
      isTerminal?: boolean;
      staleness?: 'FRESH' | 'STALE' | null;
    }>;
  }) => ({
    schoolId: overrides.schoolId,
    schoolName: overrides.schoolName,
    schoolNameZh: null,
    country: 'US',
    state: 'MA',
    usNewsRank: overrides.usNewsRank,
    scorecardId: null,
    ipedsId: null,
    criticalComplete: false,
    missingCritical: [],
    heuristicCritical: [],
    terminalCritical: [],
    staleCritical: [],
    campusLifeComplete: true,
    missingCampusLife: [],
    terminalCampusLife: [],
    staleCampusLife: [],
    fields: overrides.fields.map((f) => ({
      field: f.field,
      value: null,
      filled: f.filled ?? false,
      explicitUnknown: false,
      source: null,
      tier: null,
      confidence: null,
      fetchedAt: null,
      sourceUrl: null,
      cycleYear: null,
      notes: null,
      validatorCount: null,
      originalFormula: null,
      realDataStatus: null,
      terminalStatus: null,
      extractionMethod: null,
      reason: null,
      permanent: null,
      staleness: f.staleness ?? null,
      predictionEligible: f.filled ?? false,
      isOfficial: f.isOfficial ?? false,
      isHeuristic: f.isHeuristic ?? false,
      isTerminal: f.isTerminal ?? false,
      bucket: 'missing',
    })),
    campusLifeFields: [],
  });

  beforeEach(async () => {
    coverage = { getCoverage: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSchoolDataHealthService,
        {
          provide: AdminSchoolDataCoverageService,
          useValue: coverage,
        },
      ],
    }).compile();

    service = moduleRef.get(AdminSchoolDataHealthService);
  });

  it('ranks higher-ranked schools above lower-ranked ones for the same gap shape', async () => {
    coverage.getCoverage.mockResolvedValue({
      items: [
        buildItem({
          schoolId: 'top-school',
          schoolName: 'Top School (rank 5)',
          usNewsRank: 5,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
        buildItem({
          schoolId: 'mid-school',
          schoolName: 'Mid School (rank 80)',
          usNewsRank: 80,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
        buildItem({
          schoolId: 'tail-school',
          schoolName: 'Tail School (rank 300)',
          usNewsRank: 300,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
      ],
    });

    const result = await service.getHealthDashboard({ focus: 'intl' });

    expect(result.rows.map((r) => r.schoolId)).toEqual([
      'top-school',
      'mid-school',
      'tail-school',
    ]);
    expect(result.rows[0].importanceWeight).toBe(5);
    expect(result.rows[1].importanceWeight).toBe(3);
    // rank > 200 falls into the lowest-importance bucket (weight 1)
    expect(result.rows[2].importanceWeight).toBe(1);
  });

  it('weights "missing" twice as heavily as "heuristic" for gap calculation', async () => {
    coverage.getCoverage.mockResolvedValue({
      items: [
        buildItem({
          schoolId: 'missing-school',
          schoolName: 'Missing School',
          usNewsRank: 50, // importance 3
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
        buildItem({
          schoolId: 'heuristic-school',
          schoolName: 'Heuristic School',
          usNewsRank: 50, // importance 3
          fields: [
            {
              field: 'intlAcceptanceRate',
              filled: true,
              isHeuristic: true,
            },
          ],
        }),
      ],
    });

    const result = await service.getHealthDashboard({ focus: 'intl' });

    const missing = result.rows.find((r) => r.schoolId === 'missing-school');
    const heuristic = result.rows.find(
      (r) => r.schoolId === 'heuristic-school',
    );

    expect(missing).toBeDefined();
    expect(heuristic).toBeDefined();
    expect(missing!.priorityScore).toBeCloseTo(3 * 1.0, 3);
    expect(heuristic!.priorityScore).toBeCloseTo(3 * 0.5, 3);
  });

  it('excludes healthy schools (no gaps in the focus) from the result', async () => {
    coverage.getCoverage.mockResolvedValue({
      items: [
        buildItem({
          schoolId: 'healthy',
          schoolName: 'Healthy School',
          usNewsRank: 10,
          fields: [
            {
              field: 'intlAcceptanceRate',
              filled: true,
              isOfficial: true,
            },
            {
              field: 'needBlindInternational',
              filled: true,
              isOfficial: true,
            },
          ],
        }),
        buildItem({
          schoolId: 'needs-work',
          schoolName: 'Needs Work',
          usNewsRank: 10,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
      ],
    });

    const result = await service.getHealthDashboard({ focus: 'intl' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].schoolId).toBe('needs-work');
  });

  it('treats terminal fields (school explicitly does not publish) as non-actionable', async () => {
    coverage.getCoverage.mockResolvedValue({
      items: [
        buildItem({
          schoolId: 'terminal',
          schoolName: 'Terminal School',
          usNewsRank: 10,
          fields: [
            {
              field: 'intlAcceptanceRate',
              filled: false,
              isTerminal: true,
            },
          ],
        }),
      ],
    });

    const result = await service.getHealthDashboard({ focus: 'intl' });

    // Terminal entries do not become gaps; school drops out of the action list.
    expect(result.rows).toHaveLength(0);
    const intlTotal = result.totalsByField.find(
      (t) => t.field === 'intlAcceptanceRate',
    );
    expect(intlTotal?.terminal).toBe(1);
    expect(intlTotal?.missing).toBe(0);
  });

  it('respects the limit parameter', async () => {
    coverage.getCoverage.mockResolvedValue({
      items: Array.from({ length: 25 }, (_, i) =>
        buildItem({
          schoolId: `s${i}`,
          schoolName: `School ${i}`,
          usNewsRank: i + 1,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
      ),
    });

    const result = await service.getHealthDashboard({
      focus: 'intl',
      limit: 10,
    });

    expect(result.rows).toHaveLength(10);
    expect(result.rowsReturned).toBe(10);
  });

  it('excludes unranked schools by default and includes them when asked', async () => {
    coverage.getCoverage.mockResolvedValue({
      items: [
        buildItem({
          schoolId: 'ranked',
          schoolName: 'Ranked',
          usNewsRank: 50,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
        buildItem({
          schoolId: 'unranked',
          schoolName: 'Unranked',
          usNewsRank: null,
          fields: [{ field: 'intlAcceptanceRate', filled: false }],
        }),
      ],
    });

    const defaultResult = await service.getHealthDashboard({ focus: 'intl' });
    expect(defaultResult.rows.map((r) => r.schoolId)).toEqual(['ranked']);

    const includedResult = await service.getHealthDashboard({
      focus: 'intl',
      includeUnranked: true,
    });
    expect(includedResult.rows.map((r) => r.schoolId).sort()).toEqual([
      'ranked',
      'unranked',
    ]);
  });
});
