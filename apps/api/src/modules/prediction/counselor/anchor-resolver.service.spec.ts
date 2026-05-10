import { Prisma } from '@prisma/client';
import { AnchorResolverService } from './anchor-resolver.service';

describe('AnchorResolverService', () => {
  let service: AnchorResolverService;
  let prisma: {
    schoolCdsAdmitBand: { findFirst: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      schoolCdsAdmitBand: { findFirst: jest.fn().mockResolvedValue(null) },
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
