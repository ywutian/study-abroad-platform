import { Prisma } from '@prisma/client';
import { AnchorResolverService } from './anchor-resolver.service';

describe('AnchorResolverService', () => {
  let service: AnchorResolverService;
  let prisma: {
    schoolCdsAdmitBand: { findFirst: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      schoolCdsAdmitBand: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AnchorResolverService(prisma as any);
  });

  it('gracefully declines art/design and music conservatory schools', async () => {
    const result = await service.resolveAnchor(
      {
        gpa: 3.9,
        gpaScale: 4,
        testScores: [{ type: 'SAT', score: 1500 }],
        activities: [],
        awards: [],
      },
      {
        id: 'risd',
        name: 'Rhode Island School of Design',
        institutionType: 'ART_DESIGN',
        acceptanceRate: 0.19,
        sat25: 1350,
        sat75: 1500,
      },
    );

    expect(result.tier).toBe(4);
    expect(result.anchorSource).toBe('audition_or_portfolio_admission');
    expect(result.insufficientData?.reason).toContain(
      'audition_or_portfolio_admission',
    );
    expect(prisma.schoolCdsAdmitBand.findFirst).not.toHaveBeenCalled();
  });

  it('enforces an isotonic floor: a higher GPA band never serves a lower anchor than a lower band', async () => {
    // UC Merced's published GPA_ONLY ladder dips at the top:
    // 3.50-3.74 = 92% but 3.75-4.00 = 88%. A 3.9 applicant matches the
    // 3.75-4.00 cell (88%) and must be clamped UP to the 92% peak below it,
    // so a 3.9 never scores below a 3.6.
    prisma.schoolCdsAdmitBand.findFirst.mockImplementation(
      async ({ where }: any) => {
        if (where.gpaBand === '3.75-4.00' && where.testType === 'GPA_ONLY') {
          return { admitRate: new Prisma.Decimal(0.88) };
        }
        return null;
      },
    );
    prisma.schoolCdsAdmitBand.findMany.mockImplementation(
      async ({ where }: any) => {
        // Only the strictly-lower bands in the same (testType, testBand) ladder.
        expect(where.gpaBand.in).toEqual([
          '<3.00',
          '3.00-3.24',
          '3.25-3.49',
          '3.50-3.74',
        ]);
        expect(where.testType).toBe('GPA_ONLY');
        expect(where.testBand).toBe('ANY');
        return [
          { gpaBand: '3.50-3.74', admitRate: new Prisma.Decimal(0.92) },
          { gpaBand: '3.25-3.49', admitRate: new Prisma.Decimal(0.8) },
        ];
      },
    );

    const result = await service.resolveAnchor(
      {
        gpa: 3.9,
        gpaScale: 4,
        testScores: [],
        activities: [],
        awards: [],
      },
      {
        id: 'ucm',
        name: 'University of California, Merced',
        acceptanceRate: 0.895,
        sat25: 1080,
        sat75: 1330,
      },
    );

    expect(result.tier).toBe(1);
    expect(result.anchor).toBeCloseTo(0.92, 5); // clamped up from 0.88
  });

  it('tries UC weighted GPA bands before standard 4.0 bands', async () => {
    const gpaBands: string[] = [];
    prisma.schoolCdsAdmitBand.findFirst.mockImplementation(
      async ({ where }: any) => {
        gpaBands.push(where.gpaBand);
        if (where.gpaBand === '4.20-4.40' && where.testType === 'GPA_ONLY') {
          return { admitRate: new Prisma.Decimal(0.55) };
        }
        return null;
      },
    );

    const result = await service.resolveAnchor(
      {
        gpa: 4.3,
        gpaScale: 4.4,
        testScores: [],
        activities: [],
        awards: [],
      },
      {
        id: 'ucd',
        name: 'University of California, Davis',
        acceptanceRate: 41.8,
        sat25: 1280,
        sat75: 1450,
      },
    );

    expect(gpaBands[0]).toBe('4.20-4.40');
    expect(result.tier).toBe(1);
    expect(result.anchor).toBeCloseTo(0.55, 2);
  });
});

/**
 * Tier-2 truth table (added 2026-07-24 after acceptance review).
 *
 * Tier drives confidence drives interval width. Tier 2 is a claim that the
 * engine had a usable test signal FOR THIS APPLICANT — so it has to track what
 * `testBandMultiplier` actually consumes, not a hand-copied list. The first cut
 * of this check hardcoded SAT|ACT and silently demoted IB / A-Level / Gaokao
 * applicants; nothing caught it because tier had zero assertions anywhere.
 */
describe('AnchorResolverService · anchor tier truth table', () => {
  const resolver = () =>
    new AnchorResolverService({
      schoolCdsAdmitBand: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);

  const profileWith = (testScores: Array<{ type: string; score: number }>) => ({
    gpa: 3.9,
    gpaScale: 4,
    testScores,
    activities: [],
    awards: [],
  });

  const school = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    name: 'Test U',
    acceptanceRate: 0.15,
    sat25: 1400,
    sat75: 1550,
    ...over,
  });

  const cases: Array<
    [
      label: string,
      scores: Array<{ type: string; score: number }>,
      over: Record<string, unknown>,
      tier: number,
    ]
  > = [
    ['real band + SAT', [{ type: 'SAT', score: 1500 }], {}, 2],
    ['real band + ACT', [{ type: 'ACT', score: 33 }], {}, 2],
    // These three ARE compared against the school SAT band via an
    // SAT-equivalent, so they earn tier 2 exactly like a direct SAT.
    ['real band + IB', [{ type: 'IB', score: 42 }], {}, 2],
    ['real band + A-Level', [{ type: 'A_LEVEL', score: 152 }], {}, 2],
    ['real band + Gaokao', [{ type: 'GAOKAO', score: 690 }], {}, 2],
    // Language tests never read the band — demotion is correct here.
    ['real band + TOEFL only', [{ type: 'TOEFL', score: 110 }], {}, 3],
    ['real band + no scores', [], {}, 3],
    [
      'placeholder band + SAT',
      [{ type: 'SAT', score: 1500 }],
      { sat25: 1080, sat75: 1320 },
      3,
    ],
    [
      'no band + SAT',
      [{ type: 'SAT', score: 1500 }],
      { sat25: null, sat75: null },
      3,
    ],
  ];

  it.each(cases)('%s', async (_label, scores, over, tier) => {
    const result = await resolver().resolveAnchor(
      profileWith(scores) as any,
      school(over) as any,
    );
    expect({ tier: result.tier }).toEqual({ tier });
  });

  it('never claims SAT bands fed the anchor — the anchor is acceptanceRate', async () => {
    const result = await resolver().resolveAnchor(
      profileWith([{ type: 'SAT', score: 1500 }]) as any,
      school() as any,
    );
    // The old string was 'scorecard (acceptanceRate + SAT bands)', which read as
    // "bands are part of the anchor". They are not: the anchor is the school's
    // acceptance rate, full stop. This string lands in servedTrace.
    expect(result.anchor).toBe(0.15);
    expect(result.anchorSource).not.toContain('+ SAT bands');
  });
});
