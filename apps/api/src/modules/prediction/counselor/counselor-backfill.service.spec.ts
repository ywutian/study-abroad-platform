import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { PredictionTransformerService } from '../prediction-transformer.service';
import { CounselorEngineService } from './counselor-engine.service';
import { CounselorBackfillService } from './counselor-backfill.service';

/**
 * Coverage for the counselor backfill service (PR-7).
 *
 * The service has 3 critical behaviors:
 *   1. Per-row decision: skip already-counselor / skip Tier 4 / update otherwise
 *   2. Cache flush only after a non-dry run with updates
 *   3. Cursor pagination so admin can sweep large tables in chunks
 *
 * Real DB integration (does the SQL where-clause + cursor actually paginate
 * correctly?) lives in the e2e migration test; these unit tests mock prisma
 * to focus on decision logic + cache flush wiring.
 */
describe('CounselorBackfillService', () => {
  let service: CounselorBackfillService;
  let prisma: {
    predictionResult: { findMany: jest.Mock; update: jest.Mock };
    school: { findMany: jest.Mock };
  };
  let counselor: { compute: jest.Mock };
  let transformer: { profileToInput: jest.Mock; schoolToInput: jest.Mock };
  let redis: { delByPrefix: jest.Mock };

  const mockSchool = {
    id: 'school-1',
    name: 'Test University',
    nameZh: null,
    acceptanceRate: new Prisma.Decimal(0.5),
    sat25: 1300,
    sat75: 1500,
    satAvg: 1400,
    actAvg: null,
    isPrivate: false,
    state: 'CA',
    needBlindInternational: false,
    intlAcceptanceRate: null,
  };

  const mockProfile = {
    id: 'prof-1',
    userId: 'user-1',
    testScores: [],
    activities: [],
    awards: [],
    education: [],
  };

  const mockRow = (overrides: Partial<any> = {}) => ({
    id: 'pr-1',
    profileId: 'prof-1',
    schoolId: 'school-1',
    probability: new Prisma.Decimal(0.49),
    probabilityLow: null,
    probabilityHigh: null,
    confidence: 'medium',
    applicationRound: 'RD',
    servedTrace: null,
    profile: mockProfile,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      predictionResult: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      school: {
        findMany: jest.fn().mockResolvedValue([mockSchool]),
      },
    };
    counselor = {
      compute: jest.fn().mockResolvedValue({
        probability: 0.85,
        anchor: 0.5,
        tier: 2,
        anchorSource: 'scorecard',
        factors: [
          {
            name: 'School baseline',
            impact: 'neutral',
            weight: 1,
            detail: '50%',
          },
        ],
        modifierResults: {},
      }),
    };
    transformer = {
      profileToInput: jest.fn().mockReturnValue({
        gpa: 3.9,
        gpaScale: 4,
        testScores: [],
        activities: [],
        awards: [],
      }),
      schoolToInput: jest
        .fn()
        .mockReturnValue({ id: 'school-1', name: 'Test University' }),
    };
    redis = {
      delByPrefix: jest.fn().mockResolvedValue(42),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CounselorBackfillService,
        { provide: PrismaService, useValue: prisma },
        { provide: CounselorEngineService, useValue: counselor },
        { provide: PredictionTransformerService, useValue: transformer },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(CounselorBackfillService);
  });

  describe('dry-run mode', () => {
    it('reports counts without writing or flushing cache', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([mockRow()]);

      const result = await service.runBackfill({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.scanned).toBe(1);
      expect(result.updated).toBe(1); // counted as "would-update"
      expect(prisma.predictionResult.update).not.toHaveBeenCalled();
      expect(redis.delByPrefix).not.toHaveBeenCalled();
      expect(result.cacheKeysDeleted).toBe(0);
    });
  });

  describe('skip rules', () => {
    it('skips rows already on counselor (servedTrace.engine === counselor)', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([
        mockRow({ servedTrace: { engine: 'counselor' } }),
      ]);

      const result = await service.runBackfill({ dryRun: false });

      expect(result.skippedAlreadyCounselor).toBe(1);
      expect(result.updated).toBe(0);
      expect(counselor.compute).not.toHaveBeenCalled();
    });

    it('respects forceRecompute=true to override the skip', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([
        mockRow({ servedTrace: { engine: 'counselor' } }),
      ]);

      const result = await service.runBackfill({
        dryRun: false,
        forceRecompute: true,
      });

      expect(result.skippedAlreadyCounselor).toBe(0);
      expect(counselor.compute).toHaveBeenCalledTimes(1);
      expect(prisma.predictionResult.update).toHaveBeenCalledTimes(1);
    });

    it('skips Tier 4 (insufficient school data) — leaves fusion result intact', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([mockRow()]);
      counselor.compute.mockResolvedValueOnce({
        probability: 0,
        anchor: 0,
        tier: 4,
        anchorSource: 'none',
        factors: [],
        insufficientData: { reason: 'school_missing_acceptance_rate' },
        modifierResults: {},
      });

      const result = await service.runBackfill({ dryRun: false });

      expect(result.skippedTier4).toBe(1);
      expect(prisma.predictionResult.update).not.toHaveBeenCalled();
    });

    it('skips rows with missing profile (legacy data)', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([
        mockRow({ profile: null }),
      ]);

      const result = await service.runBackfill({ dryRun: false });

      expect(result.skippedMissingProfile).toBe(1);
      expect(counselor.compute).not.toHaveBeenCalled();
    });
  });

  describe('write path', () => {
    it('updates probability + factors + servedTrace on a non-dry run', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([mockRow()]);

      const result = await service.runBackfill({ dryRun: false });

      expect(result.updated).toBe(1);
      expect(prisma.predictionResult.update).toHaveBeenCalledTimes(1);
      const updateCall = prisma.predictionResult.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'pr-1' });
      expect(updateCall.data.probability).toBe(0.85);
      expect(updateCall.data.confidenceReason).toContain('rules-of-thumb');
      const trace = updateCall.data.servedTrace;
      expect(trace.engine).toBe('counselor');
      expect(trace.counselor.tier).toBe(2);
      expect(trace.counselor.backfilledAt).toBeDefined();
    });

    it('preserves pre-existing fusion data in shadow.fusion', async () => {
      // Row has no shadow yet — backfill should capture current probability there
      prisma.predictionResult.findMany.mockResolvedValue([
        mockRow({
          probability: new Prisma.Decimal(0.49),
          servedTrace: { policyVersionId: 'v3' }, // existing trace, no shadow yet
        }),
      ]);

      await service.runBackfill({ dryRun: false });

      const trace =
        prisma.predictionResult.update.mock.calls[0][0].data.servedTrace;
      expect(trace.policyVersionId).toBe('v3'); // existing field preserved
      expect(trace.shadow.fusion.probability).toBe(0.49); // pre-counselor probability captured
      expect(trace.shadow.fusion.capturedDuringBackfill).toBe(true);
    });

    it('does NOT overwrite existing shadow.fusion if already present', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([
        mockRow({
          servedTrace: {
            engine: 'fusion',
            shadow: { fusion: { probability: 0.42, capturedAt: 'earlier' } },
          },
        }),
      ]);

      await service.runBackfill({ dryRun: false });

      const trace =
        prisma.predictionResult.update.mock.calls[0][0].data.servedTrace;
      expect(trace.shadow.fusion.probability).toBe(0.42); // existing untouched
      expect(trace.shadow.fusion.capturedAt).toBe('earlier');
    });
  });

  describe('cache flush', () => {
    it('flushes Redis prediction:* keys after non-dry run with updates', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([mockRow()]);

      const result = await service.runBackfill({ dryRun: false });

      expect(redis.delByPrefix).toHaveBeenCalledWith('prediction:');
      expect(result.cacheKeysDeleted).toBe(42);
    });

    it('skips cache flush when skipCacheFlush=true (multi-batch sweep)', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([mockRow()]);

      const result = await service.runBackfill({
        dryRun: false,
        skipCacheFlush: true,
      });

      expect(redis.delByPrefix).not.toHaveBeenCalled();
      expect(result.cacheKeysDeleted).toBe(0);
    });

    it('skips cache flush when nothing was updated (no work done)', async () => {
      prisma.predictionResult.findMany.mockResolvedValue([
        mockRow({ servedTrace: { engine: 'counselor' } }), // already-counselor → skipped
      ]);

      await service.runBackfill({ dryRun: false });

      expect(redis.delByPrefix).not.toHaveBeenCalled();
    });
  });

  describe('cursor pagination', () => {
    it('emits nextCursor when batchSize+1 rows return (more pages exist)', async () => {
      const rows = Array.from({ length: 6 }, (_, i) =>
        mockRow({ id: `pr-${i + 1}` }),
      );
      prisma.predictionResult.findMany.mockResolvedValue(rows);

      const result = await service.runBackfill({ dryRun: true, batchSize: 5 });

      expect(result.scanned).toBe(5); // not 6 — last is the "peek-ahead" probe
      expect(result.nextCursor).toBe('pr-5'); // last id of processed batch
    });

    it('emits nextCursor=null when fewer than batchSize+1 rows return (last page)', async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        mockRow({ id: `pr-${i + 1}` }),
      );
      prisma.predictionResult.findMany.mockResolvedValue(rows);

      const result = await service.runBackfill({ dryRun: true, batchSize: 5 });

      expect(result.scanned).toBe(3);
      expect(result.nextCursor).toBeNull();
    });
  });
});
