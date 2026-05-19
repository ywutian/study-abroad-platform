import { Test, TestingModule } from '@nestjs/testing';
import { HallVerifiedDashboardService } from './hall-verified-dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Hall Plan C (C4) — the difficulty signal must be derived from the admit
 * RATE (admitted / total), not the raw admit count. A year where users
 * happened to submit more cases must NOT read as "admission got easier".
 */
describe('HallVerifiedDashboardService', () => {
  let service: HallVerifiedDashboardService;

  const mockPrisma = {
    admissionCase: { findMany: jest.fn() },
    school: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HallVerifiedDashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(HallVerifiedDashboardService);
    mockPrisma.school.findMany.mockResolvedValue([{ id: 'school-1' }]);
  });

  afterEach(() => jest.clearAllMocks());

  /** Build `count` admissionCase rows for one school/year with a result. */
  const rows = (year: number, admitted: number, rejected: number) => [
    ...Array.from({ length: admitted }, () => ({
      schoolId: 'school-1',
      year,
      result: 'ADMITTED',
      school: { name: 'School 1', nameZh: null, usNewsRank: 1 },
    })),
    ...Array.from({ length: rejected }, () => ({
      schoolId: 'school-1',
      year,
      result: 'REJECTED',
      school: { name: 'School 1', nameZh: null, usNewsRank: 1 },
    })),
  ];

  describe('getDifficultySignal', () => {
    it('flags a sharp admit-RATE drop as surging (not a count change)', async () => {
      // Year A: 6 admitted / 6 total = 100% rate.
      // Year B: 1 admitted / 6 total = ~17% rate. Rate fell ~83pt → surging.
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        ...rows(2024, 6, 0),
        ...rows(2025, 1, 5),
      ]);

      const [entry] = await service.getDifficultySignal(['school-1']);

      expect(entry.signal).toBe('surging');
      expect(entry.changePct).toBeLessThan(-25);
    });

    it('stays stable when the admit RATE holds even though COUNT exploded', async () => {
      // Year A: 2/4 = 50%. Year B: 6/12 = 50%. Count tripled, rate flat.
      // Old count-based logic would have called this a +200% surge.
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        ...rows(2024, 2, 2),
        ...rows(2025, 6, 6),
      ]);

      const [entry] = await service.getDifficultySignal(['school-1']);

      expect(entry.signal).toBe('stable');
      expect(entry.changePct).toBe(0);
    });

    it('ignores years below the minimum total when computing the rate', async () => {
      // Year A: 1/1 = 100% — below MIN_YEAR_TOTAL (3), must be dropped.
      // Year B: 3/6 = 50% — only one rate-eligible year left → stable.
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        ...rows(2024, 1, 0),
        ...rows(2025, 3, 3),
      ]);

      const [entry] = await service.getDifficultySignal(['school-1']);

      expect(entry.signal).toBe('stable');
    });

    it('flags a moderate admit-rate decline as declining', async () => {
      // Year A: 8/10 = 80%. Year B: 7/10 = 70%. Year C: 6/10 = 60%.
      // Worst single YoY drop is only -10pt (not > 25), but the cumulative
      // drop is 20pt (> 15) → declining, not surging.
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        ...rows(2023, 8, 2),
        ...rows(2024, 7, 3),
        ...rows(2025, 6, 4),
      ]);

      const [entry] = await service.getDifficultySignal(['school-1']);

      expect(entry.signal).toBe('declining');
      expect(entry.changePct).toBeLessThan(-15);
    });
  });
});
