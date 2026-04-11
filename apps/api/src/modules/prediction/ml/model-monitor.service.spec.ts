import { ModelMonitorService } from './model-monitor.service';

describe('ModelMonitorService', () => {
  let service: ModelMonitorService;
  let prisma: {
    predictionResult: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      predictionResult: {
        findMany: jest.fn(),
      },
    };

    service = new ModelMonitorService(
      prisma as any,
      {
        setJSON: jest.fn(),
        getJSON: jest.fn(),
        lpush: jest.fn(),
        ltrim: jest.fn(),
        lrange: jest.fn(),
      } as any,
      { countAvailableOutcomes: jest.fn(), getDatasetStats: jest.fn() } as any,
      { getChampionModel: jest.fn() } as any,
    );
  });

  it('filters calibration to verified admitted/rejected outcomes only', async () => {
    prisma.predictionResult.findMany.mockResolvedValue([
      {
        probability: 0.61,
        outcomeLabelRecords: [
          {
            result: 'ADMITTED',
            status: 'DOCUMENT_VERIFIED',
            isFinal: true,
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            resolvedAt: new Date('2026-04-09T00:00:00.000Z'),
          },
        ],
      },
      {
        probability: 0.24,
        outcomeLabelRecords: [
          {
            result: 'REJECTED',
            status: 'COUNSELOR_VERIFIED',
            isFinal: true,
            createdAt: new Date('2026-04-08T00:00:00.000Z'),
            resolvedAt: new Date('2026-04-08T00:00:00.000Z'),
          },
        ],
      },
      {
        probability: 0.77,
        outcomeLabelRecords: [
          {
            result: 'ADMITTED',
            status: 'SELF_REPORTED',
            isFinal: true,
            createdAt: new Date('2026-04-07T00:00:00.000Z'),
            resolvedAt: new Date('2026-04-07T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const report = await (service as any).checkCalibration();

    expect(prisma.predictionResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          outcomeLabelRecords: {
            some: {
              status: { in: ['COUNSELOR_VERIFIED', 'DOCUMENT_VERIFIED'] },
              result: { in: ['ADMITTED', 'REJECTED'] },
            },
          },
        }),
      }),
    );
    expect(report.recentOutcomeCount).toBe(2);
    expect(report.message).toBe(
      'Only 2/20 verified ADMITTED/REJECTED outcomes available for calibration check',
    );
  });

  it('distinguishes zero verified outcomes from low verified sample size', async () => {
    prisma.predictionResult.findMany.mockResolvedValue([
      {
        probability: 0.77,
        outcomeLabelRecords: [
          {
            result: 'ADMITTED',
            status: 'SELF_REPORTED',
            isFinal: true,
            createdAt: new Date('2026-04-07T00:00:00.000Z'),
            resolvedAt: new Date('2026-04-07T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const report = await (service as any).checkCalibration();

    expect(report.recentOutcomeCount).toBe(0);
    expect(report.message).toBe(
      'No verified ADMITTED/REJECTED outcomes available for calibration check (0/20)',
    );
  });
});
