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
      } as any,
      {
        id: 'ucd',
        name: 'University of California, Davis',
        acceptanceRate: 41.8,
        sat25: 1280,
        sat75: 1450,
      } as any,
    );

    expect(gpaBands[0]).toBe('4.20-4.40');
    expect(result.tier).toBe(1);
    expect(result.anchor).toBeCloseTo(0.55, 2);
  });
});
