import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PredictionWorkflowService } from './prediction-workflow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionReportingService } from './prediction-reporting.service';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

const ACTOR_ID = 'actor-admin-1';

function createMockPolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    policyKey: 'default',
    version: 1,
    name: 'Test Policy',
    description: null,
    status: 'DRAFT',
    thresholds: null,
    rolloutConfig: {},
    monitoringConfig: {},
    fairnessConfig: {},
    calibrationVersion: null,
    numericCoreVersion: null,
    explanationSchemaVersion: null,
    priorSetVersion: null,
    driftSetVersion: null,
    relationshipSetVersion: null,
    effectiveFrom: null,
    activatedAt: null,
    promotedAt: null,
    activatedBy: null,
    retiredAt: null,
    shadowStartedAt: null,
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function createMockObservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'obs-1',
    profileId: null,
    schoolId: 'school-1',
    highSchoolId: null,
    policyVersionId: null,
    cohortKey: 'CN__CHINA_LOCAL',
    round: 'RD',
    metricType: 'acceptance_rate',
    rate: null,
    admitCount: 50,
    applyCount: 200,
    year: 2025,
    sourceType: 'CDS',
    sourceName: 'Common Data Set',
    sourceVersion: null,
    sourceUrl: null,
    license: null,
    qualityScore: 85,
    observationStage: 'SERVE',
    observedProbability: null,
    observedProbabilityLow: null,
    observedProbabilityHigh: null,
    observedWeight: null,
    confidenceLabel: null,
    sampleCount: null,
    selectivityBand: null,
    reviewAt: null,
    expiresAt: null,
    effectiveFromCycle: null,
    metadata: null,
    notes: null,
    status: 'RAW',
    reviewedBy: null,
    observedAt: new Date('2025-12-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('PredictionWorkflowService', () => {
  let service: PredictionWorkflowService;
  let prisma: PrismaService;
  let redis: RedisService;
  let auditLog: AuditLogService;
  let historicalService: PredictionHistoricalService;
  let reportingService: PredictionReportingService;

  // Transaction mock: callback-style
  const mockTx = {
    predictionPolicyVersion: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    schoolCohortRoundPrior: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
    schoolCohortRegimeSignal: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
    schoolRelationshipSignal: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionWorkflowService,
        {
          provide: PrismaService,
          useValue: {
            predictionSourceObservation: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn().mockImplementation((args) => ({
                id: 'obs-new',
                ...args.data,
              })),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
            },
            predictionPolicyVersion: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn().mockImplementation((args) => ({
                id: 'policy-new',
                ...args.data,
              })),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            predictionResult: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              groupBy: jest.fn().mockResolvedValue([]),
            },
            predictionSnapshot: {
              groupBy: jest.fn().mockResolvedValue([]),
            },
            schoolCohortRoundPrior: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest
                .fn()
                .mockImplementation(({ data }) => ({ id: 'prior-1', ...data })),
              update: jest
                .fn()
                .mockImplementation(({ data }) => ({ id: 'prior-1', ...data })),
            },
            schoolCohortRegimeSignal: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            schoolRelationshipSignal: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            highSchool: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            school: {
              findUnique: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
            },
            schoolProgram: {
              count: jest.fn().mockResolvedValue(0),
            },
            schoolCalibration: {
              count: jest.fn().mockResolvedValue(0),
            },
            schoolMetric: {
              count: jest.fn().mockResolvedValue(0),
              findMany: jest.fn().mockResolvedValue([]),
            },
            admissionCase: {
              count: jest.fn().mockResolvedValue(0),
              groupBy: jest.fn().mockResolvedValue([]),
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockImplementation(({ where, data }) => ({
                id: where.id,
                ...data,
              })),
            },
            predictionOutcomeLabelRecord: {
              count: jest.fn().mockResolvedValue(0),
            },
            $transaction: jest
              .fn()
              .mockImplementation((fn) =>
                typeof fn === 'function' ? fn(mockTx) : Promise.all(fn),
              ),
          },
        },
        {
          provide: RedisService,
          useValue: {
            delByPrefix: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionHistoricalService,
          useValue: {
            getFeederSignal: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PredictionReportingService,
          useValue: {
            getOutcomeReviewQueue: jest.fn().mockResolvedValue({
              items: [],
              total: 0,
              page: 1,
              pageSize: 20,
              totalPages: 0,
            }),
            reviewOutcomeLabel: jest.fn().mockResolvedValue({ id: 'label-1' }),
            resolveCanonicalOutcome: jest.fn().mockReturnValue({
              canonicalRecord: null,
              displayRecord: null,
              canonicalOutcomeLabel: 'UNKNOWN',
              eligibleForCalibration: false,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(PredictionWorkflowService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    auditLog = module.get(AuditLogService);
    historicalService = module.get(PredictionHistoricalService);
    reportingService = module.get(PredictionReportingService);

    // Reset tx mocks each test
    Object.values(mockTx).forEach((model) =>
      Object.values(model).forEach((fn) => fn.mockClear()),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // P0 — getPolicyGateSummary
  // =========================================================================

  describe('getPolicyGateSummary', () => {
    const setupGateTest = (
      policyOverrides: Record<string, unknown> = {},
      predictionCount = 2000,
      resolvedLabels = 500,
      cohortCounts = {
        CN__CHINA_LOCAL: 100,
        CN__CHINA_INTL: 100,
        CN__OVERSEAS_HS: 100,
      },
      shadowMetrics: Record<string, unknown> = {
        aucDelta: 0.05,
        brierDelta: -0.03,
        eceDelta: 0.01,
      },
    ) => {
      const policy = createMockPolicy({
        status: 'SHADOW',
        monitoringConfig: { shadowMetrics },
        ...policyOverrides,
      });

      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(
        predictionCount,
      );

      // Mock getEligibleOutcomeCounts via predictionResult.findMany
      const mockResults: Array<{
        id: string;
        cohortKey: string;
        outcomeLabelRecords: unknown[];
      }> = [];
      // Build mock prediction results to satisfy cohort counts
      for (const [cohortKey, count] of Object.entries(cohortCounts)) {
        for (let i = 0; i < count; i++) {
          mockResults.push({
            id: `pred-${cohortKey}-${i}`,
            cohortKey,
            outcomeLabelRecords: [
              {
                id: `label-${cohortKey}-${i}`,
                result: 'ADMITTED',
                status: 'COUNSELOR_VERIFIED',
                createdAt: new Date(),
              },
            ],
          });
        }
      }

      // Add uncohorted resolved labels to reach total
      const cohortTotal = Object.values(cohortCounts).reduce(
        (a, b) => a + b,
        0,
      );
      for (let i = 0; i < resolvedLabels - cohortTotal; i++) {
        mockResults.push({
          id: `pred-extra-${i}`,
          cohortKey: 'OTHER',
          outcomeLabelRecords: [
            {
              id: `label-extra-${i}`,
              result: 'REJECTED',
              status: 'COUNSELOR_VERIFIED',
              createdAt: new Date(),
            },
          ],
        });
      }

      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );

      // resolveCanonicalOutcome needs to return eligibleForCalibration: true
      (reportingService.resolveCanonicalOutcome as jest.Mock).mockReturnValue({
        canonicalRecord: { result: 'ADMITTED', status: 'COUNSELOR_VERIFIED' },
        displayRecord: null,
        canonicalOutcomeLabel: 'ADMITTED',
        eligibleForCalibration: true,
      });
    };

    it('should return ready=true when all gates pass', async () => {
      setupGateTest();

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(true);
      expect(result.failures).toEqual([]);
    });

    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.getPolicyGateSummary('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fail when shadow predictions below minimum', async () => {
      setupGateTest({}, 500); // default minShadowPredictions = 1000

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain(
        'Not enough shadow predictions for promotion',
      );
    });

    it('should fail when resolved labels below minimum', async () => {
      // With 100 total resolved labels (split across 3 cohorts ~33 each),
      // cohort gates will also fail. Set cohort counts explicitly.
      setupGateTest(
        {},
        2000,
        100, // below minResolvedLabels = 200
        { CN__CHINA_LOCAL: 33, CN__CHINA_INTL: 33, CN__OVERSEAS_HS: 34 },
      );

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain(
        'Not enough resolved labels for promotion',
      );
    });

    it('should fail when a cohort resolved label count is below gate', async () => {
      setupGateTest({}, 2000, 500, {
        CN__CHINA_LOCAL: 100,
        CN__CHINA_INTL: 10, // below minCohortResolvedLabels = 50
        CN__OVERSEAS_HS: 100,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([expect.stringContaining('CN__CHINA_INTL')]),
      );
    });

    it('should fail when AUC delta is missing', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        brierDelta: -0.03,
        eceDelta: 0.01,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain(
        'AUC delta is missing from shadow metrics',
      );
    });

    it('should fail when AUC delta is below threshold', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        aucDelta: 0.005, // below minAucDelta = 0.01
        brierDelta: -0.03,
        eceDelta: 0.01,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain('AUC gate failed');
    });

    it('should fail when Brier delta is missing', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        aucDelta: 0.05,
        eceDelta: 0.01,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain(
        'Brier delta is missing from shadow metrics',
      );
    });

    it('should fail when Brier delta exceeds threshold', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        aucDelta: 0.05,
        brierDelta: 0.01, // > maxBrierDelta = -0.01
        eceDelta: 0.01,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain('Brier gate failed');
    });

    it('should fail when ECE delta is missing', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        aucDelta: 0.05,
        brierDelta: -0.03,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain(
        'ECE delta is missing from shadow metrics',
      );
    });

    it('should fail when ECE delta exceeds threshold', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        aucDelta: 0.05,
        brierDelta: -0.03,
        eceDelta: 0.05, // > maxEceRegression = 0.02
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain('ECE gate failed');
    });

    it('should fail when fairness is blocked', async () => {
      setupGateTest({}, 2000, 500, undefined, {
        aucDelta: 0.05,
        brierDelta: -0.03,
        eceDelta: 0.01,
        fairnessBlocked: true,
      });

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      expect(result.failures).toContain('Fairness gate failed');
    });

    it('should use custom thresholds from policy when provided', async () => {
      setupGateTest(
        {
          thresholds: {
            minShadowPredictions: 100,
            minResolvedLabels: 10,
            minCohortResolvedLabels: 5,
            minAucDelta: 0.001,
            maxBrierDelta: 0,
            maxEceRegression: 0.1,
          },
        },
        150, // passes custom threshold of 100
        50,
        { CN__CHINA_LOCAL: 10, CN__CHINA_INTL: 10, CN__OVERSEAS_HS: 10 },
      );

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(true);
      expect(result.failures).toEqual([]);
    });

    it('should accumulate multiple failures', async () => {
      setupGateTest(
        {},
        100, // below minShadowPredictions
        50, // below minResolvedLabels
        { CN__CHINA_LOCAL: 5, CN__CHINA_INTL: 5, CN__OVERSEAS_HS: 5 }, // below minCohortResolvedLabels
        {}, // missing all shadow metrics
      );

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.ready).toBe(false);
      // Should have at least: shadow predictions, resolved labels, 3 cohorts, 3 metrics
      expect(result.failures.length).toBeGreaterThanOrEqual(8);
    });

    it('should return threshold values and counts in summary', async () => {
      setupGateTest();

      const result = await service.getPolicyGateSummary('policy-1');

      expect(result.thresholds).toBeDefined();
      expect(result.thresholds.minShadowPredictions).toBe(1000);
      expect(result.counts).toBeDefined();
      expect(result.counts.shadowPredictions).toBe(2000);
      expect(result.shadowMetrics).toBeDefined();
    });
  });

  // =========================================================================
  // P0 — activatePolicy
  // =========================================================================

  describe('activatePolicy', () => {
    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.activatePolicy(ACTOR_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when policy is not SHADOW', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy({ status: 'DRAFT' }));

      await expect(
        service.activatePolicy(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when policy is ACTIVE (not SHADOW)', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy({ status: 'ACTIVE' }));

      await expect(
        service.activatePolicy(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when gate check fails', async () => {
      // Policy is SHADOW, but gate will fail due to low predictions
      const policy = createMockPolicy({
        status: 'SHADOW',
        monitoringConfig: {},
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(0);
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.activatePolicy(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should retire existing ACTIVE policy and activate new one on success', async () => {
      // Setup SHADOW policy that passes all gates
      const policy = createMockPolicy({
        status: 'SHADOW',
        monitoringConfig: {
          shadowMetrics: {
            aucDelta: 0.05,
            brierDelta: -0.03,
            eceDelta: 0.01,
          },
        },
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(2000);

      // Build mock results that satisfy all cohort counts
      const mockResults: unknown[] = [];
      for (const cohortKey of [
        'CN__CHINA_LOCAL',
        'CN__CHINA_INTL',
        'CN__OVERSEAS_HS',
      ]) {
        for (let i = 0; i < 100; i++) {
          mockResults.push({
            id: `pred-${cohortKey}-${i}`,
            cohortKey,
            outcomeLabelRecords: [
              {
                result: 'ADMITTED',
                status: 'COUNSELOR_VERIFIED',
                createdAt: new Date(),
              },
            ],
          });
        }
      }
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );
      (reportingService.resolveCanonicalOutcome as jest.Mock).mockReturnValue({
        canonicalRecord: { result: 'ADMITTED' },
        eligibleForCalibration: true,
      });

      const result = await service.activatePolicy(ACTOR_ID, 'policy-1');

      expect(result.success).toBe(true);
      expect(result.policyVersionId).toBe('policy-1');
      expect(result.activatedBy).toBe(ACTOR_ID);

      // Verify transaction retired old and activated new
      expect(mockTx.predictionPolicyVersion.updateMany).toHaveBeenCalledWith({
        where: { policyKey: 'default', status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'RETIRED' }),
      });
      expect(mockTx.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          activatedBy: ACTOR_ID,
        }),
      });
    });

    it('should invalidate prediction caches after activation', async () => {
      // Use same setup as success test
      const policy = createMockPolicy({
        status: 'SHADOW',
        monitoringConfig: {
          shadowMetrics: {
            aucDelta: 0.05,
            brierDelta: -0.03,
            eceDelta: 0.01,
          },
        },
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(2000);

      const mockResults: unknown[] = [];
      for (const cohortKey of [
        'CN__CHINA_LOCAL',
        'CN__CHINA_INTL',
        'CN__OVERSEAS_HS',
      ]) {
        for (let i = 0; i < 100; i++) {
          mockResults.push({
            id: `pred-${cohortKey}-${i}`,
            cohortKey,
            outcomeLabelRecords: [
              {
                result: 'ADMITTED',
                status: 'COUNSELOR_VERIFIED',
                createdAt: new Date(),
              },
            ],
          });
        }
      }
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );
      (reportingService.resolveCanonicalOutcome as jest.Mock).mockReturnValue({
        canonicalRecord: { result: 'ADMITTED' },
        eligibleForCalibration: true,
      });

      await service.activatePolicy(ACTOR_ID, 'policy-1');

      expect(redis.delByPrefix).toHaveBeenCalled();
    });

    it('should write audit log after activation', async () => {
      const policy = createMockPolicy({
        status: 'SHADOW',
        monitoringConfig: {
          shadowMetrics: {
            aucDelta: 0.05,
            brierDelta: -0.03,
            eceDelta: 0.01,
          },
        },
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(2000);

      const mockResults: unknown[] = [];
      for (const cohortKey of [
        'CN__CHINA_LOCAL',
        'CN__CHINA_INTL',
        'CN__OVERSEAS_HS',
      ]) {
        for (let i = 0; i < 100; i++) {
          mockResults.push({
            id: `pred-${cohortKey}-${i}`,
            cohortKey,
            outcomeLabelRecords: [
              {
                result: 'ADMITTED',
                status: 'COUNSELOR_VERIFIED',
                createdAt: new Date(),
              },
            ],
          });
        }
      }
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        mockResults,
      );
      (reportingService.resolveCanonicalOutcome as jest.Mock).mockReturnValue({
        canonicalRecord: { result: 'ADMITTED' },
        eligibleForCalibration: true,
      });

      await service.activatePolicy(ACTOR_ID, 'policy-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ACTOR_ID,
          resource: 'prediction_policy',
          resourceId: 'policy-1',
          metadata: expect.objectContaining({
            action: 'PREDICTION_POLICY_ACTIVATE',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P0 — rollbackPolicy
  // =========================================================================

  describe('rollbackPolicy', () => {
    it('should throw NotFoundException when no ACTIVE policy exists', async () => {
      (prisma.predictionPolicyVersion.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.rollbackPolicy(ACTOR_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.rollbackPolicy(ACTOR_ID)).rejects.toThrow(
        /No active prediction policy/,
      );
    });

    it('should throw NotFoundException when no RETIRED policy exists', async () => {
      // rollbackPolicy uses Promise.all([findFirst(ACTIVE), findFirst(RETIRED)])
      // so both calls happen in parallel. We need mockResolvedValue for the first
      // and then override on the second call. Since Promise.all runs both
      // findFirst calls, we use mockResolvedValueOnce for both.
      (prisma.predictionPolicyVersion.findFirst as jest.Mock)
        .mockResolvedValueOnce(
          createMockPolicy({ status: 'ACTIVE', id: 'active-1' }),
        )
        .mockResolvedValueOnce(null);

      await expect(service.rollbackPolicy(ACTOR_ID)).rejects.toThrow(
        /No retired prediction policy/,
      );
    });

    it('should swap ACTIVE and RETIRED statuses successfully', async () => {
      const activePolicy = createMockPolicy({
        id: 'active-1',
        status: 'ACTIVE',
        notes: 'active notes',
      });
      const retiredPolicy = createMockPolicy({
        id: 'retired-1',
        status: 'RETIRED',
        notes: 'retired notes',
      });

      (prisma.predictionPolicyVersion.findFirst as jest.Mock)
        .mockResolvedValueOnce(activePolicy)
        .mockResolvedValueOnce(retiredPolicy);

      const result = await service.rollbackPolicy(ACTOR_ID);

      expect(result.success).toBe(true);
      expect(result.rolledBackFrom).toBe('active-1');
      expect(result.restoredPolicyVersionId).toBe('retired-1');

      // Active -> Retired
      expect(mockTx.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'active-1' },
        data: expect.objectContaining({
          status: 'RETIRED',
          notes: expect.stringContaining('rollback-retired'),
        }),
      });

      // Retired -> Active
      expect(mockTx.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'retired-1' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          activatedBy: ACTOR_ID,
          retiredAt: null,
          notes: expect.stringContaining('rollback-restore'),
        }),
      });
    });

    it('should invalidate caches for both old and new active policies', async () => {
      (prisma.predictionPolicyVersion.findFirst as jest.Mock)
        .mockResolvedValueOnce(
          createMockPolicy({ id: 'active-1', status: 'ACTIVE' }),
        )
        .mockResolvedValueOnce(
          createMockPolicy({ id: 'retired-1', status: 'RETIRED' }),
        );

      await service.rollbackPolicy(ACTOR_ID);

      // Should invalidate both policy version caches
      expect(redis.delByPrefix).toHaveBeenCalledWith(
        expect.stringContaining('active-1'),
      );
      expect(redis.delByPrefix).toHaveBeenCalledWith(
        expect.stringContaining('retired-1'),
      );
    });

    it('should write audit log with rollback details', async () => {
      (prisma.predictionPolicyVersion.findFirst as jest.Mock)
        .mockResolvedValueOnce(
          createMockPolicy({ id: 'active-1', status: 'ACTIVE' }),
        )
        .mockResolvedValueOnce(
          createMockPolicy({ id: 'retired-1', status: 'RETIRED' }),
        );

      await service.rollbackPolicy(ACTOR_ID, 'custom-key');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_POLICY_ROLLBACK',
            policyKey: 'custom-key',
            rolledBackFrom: 'active-1',
            restoredPolicyVersionId: 'retired-1',
          }),
        }),
      );
    });

    it('should use default policyKey when not specified', async () => {
      (prisma.predictionPolicyVersion.findFirst as jest.Mock)
        .mockResolvedValueOnce(
          createMockPolicy({ id: 'active-1', status: 'ACTIVE' }),
        )
        .mockResolvedValueOnce(
          createMockPolicy({ id: 'retired-1', status: 'RETIRED' }),
        );

      const result = await service.rollbackPolicy(ACTOR_ID);

      expect(result.policyKey).toBe('default');
    });
  });

  // =========================================================================
  // P0 — buildActiveSignals
  // =========================================================================

  describe('buildActiveSignals', () => {
    const setupBuildSignalsTest = () => {
      const policy = createMockPolicy({
        id: 'policy-1',
        policyKey: 'default',
        version: 1,
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);
    };

    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.buildActiveSignals(ACTOR_ID, {
          policyVersionId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should classify APPROVED_FOR_PRIOR observations as priors', async () => {
      setupBuildSignalsTest();

      const priorObs = createMockObservation({
        id: 'obs-prior-1',
        status: 'APPROVED_FOR_PRIOR',
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        round: 'RD',
        admitCount: 50,
        applyCount: 200,
        observationStage: 'SERVE',
        metricType: 'acceptance_rate',
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([priorObs]);

      const result = await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(result.priorsBuilt).toBe(1);
      expect(result.driftSignalsBuilt).toBe(0);
      expect(result.relationshipSignalsBuilt).toBe(0);
      expect(mockTx.schoolCohortRoundPrior.create).toHaveBeenCalledTimes(1);
    });

    it('should classify APPROVED_FOR_SIGNAL drift observations', async () => {
      setupBuildSignalsTest();

      const driftObs = createMockObservation({
        id: 'obs-drift-1',
        status: 'APPROVED_FOR_SIGNAL',
        schoolId: 'school-1',
        observationStage: 'DRIFT',
        metricType: 'acceptance_rate_drift',
        metadata: { driftMultiplier: 1.2 },
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([driftObs]);

      const result = await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(result.driftSignalsBuilt).toBe(1);
      expect(mockTx.schoolCohortRegimeSignal.create).toHaveBeenCalledTimes(1);
    });

    it('should classify APPROVED_FOR_SIGNAL relationship observations', async () => {
      setupBuildSignalsTest();

      const relObs = createMockObservation({
        id: 'obs-rel-1',
        status: 'APPROVED_FOR_SIGNAL',
        schoolId: 'school-1',
        highSchoolId: 'hs-1',
        sourceType: 'RELATIONSHIP_EVIDENCE',
        observationStage: 'RELATIONSHIP',
        metricType: 'partnership_signal',
        reviewAt: new Date(),
        expiresAt: new Date('2027-01-01'),
        metadata: { maxImpactCap: 0.05 },
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([relObs]);

      const result = await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(result.relationshipSignalsBuilt).toBe(1);
      expect(mockTx.schoolRelationshipSignal.create).toHaveBeenCalledTimes(1);
    });

    it('should skip observations with excluded statuses', async () => {
      setupBuildSignalsTest();

      const expiredObs = createMockObservation({
        status: 'EXPIRED',
        schoolId: 'school-1',
      });
      const supersededObs = createMockObservation({
        status: 'SUPERSEDED',
        schoolId: 'school-1',
      });
      const blockedObs = createMockObservation({
        status: 'LICENSE_BLOCKED',
        schoolId: 'school-1',
      });
      const flaggedObs = createMockObservation({
        status: 'CONFLICT_FLAGGED',
        schoolId: 'school-1',
      });

      // These won't be returned from the query (status filter), but test the
      // classification logic if they somehow appear
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([expiredObs, supersededObs, blockedObs, flaggedObs]);

      const result = await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(result.priorsBuilt).toBe(0);
      expect(result.driftSignalsBuilt).toBe(0);
      expect(result.relationshipSignalsBuilt).toBe(0);
    });

    it('should use $transaction for all signal writes', async () => {
      setupBuildSignalsTest();
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([]);

      await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should delete existing signals before creating new ones', async () => {
      setupBuildSignalsTest();
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([]);

      await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(mockTx.schoolCohortRoundPrior.deleteMany).toHaveBeenCalled();
      expect(mockTx.schoolCohortRegimeSignal.deleteMany).toHaveBeenCalled();
      expect(mockTx.schoolRelationshipSignal.deleteMany).toHaveBeenCalled();
    });

    it('should update policy version with set version strings', async () => {
      setupBuildSignalsTest();
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([]);

      await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(mockTx.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: expect.objectContaining({
          priorSetVersion: 'default:1:prior',
          driftSetVersion: 'default:1:drift',
          relationshipSetVersion: 'default:1:relationship',
        }),
      });
    });

    it('should compute prior rate from admitCount/applyCount when rate is null', async () => {
      setupBuildSignalsTest();

      const obs = createMockObservation({
        status: 'APPROVED_FOR_PRIOR',
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        round: 'RD',
        rate: null,
        admitCount: 30,
        applyCount: 100,
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([obs]);

      await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(mockTx.schoolCohortRoundPrior.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priorRate: 0.3, // 30/100
        }),
      });
    });

    it('should use direct rate when available', async () => {
      setupBuildSignalsTest();

      const obs = createMockObservation({
        status: 'APPROVED_FOR_PRIOR',
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        round: 'RD',
        rate: 0.25,
        admitCount: 30,
        applyCount: 100,
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([obs]);

      await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(mockTx.schoolCohortRoundPrior.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priorRate: 0.25,
        }),
      });
    });

    it('should write audit log after building signals', async () => {
      setupBuildSignalsTest();
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([]);

      await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_SIGNALS_BUILD',
          }),
        }),
      );
    });

    it('should handle mixed observation types in a single build', async () => {
      setupBuildSignalsTest();

      const priorObs = createMockObservation({
        id: 'obs-prior',
        status: 'APPROVED_FOR_PRIOR',
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        round: 'RD',
        admitCount: 50,
        applyCount: 200,
      });
      const driftObs = createMockObservation({
        id: 'obs-drift',
        status: 'APPROVED_FOR_SIGNAL',
        schoolId: 'school-2',
        observationStage: 'DRIFT',
        metricType: 'drift_multiplier',
        metadata: { driftMultiplier: 0.9 },
      });
      const relObs = createMockObservation({
        id: 'obs-rel',
        status: 'APPROVED_FOR_SIGNAL',
        schoolId: 'school-3',
        highSchoolId: 'hs-1',
        sourceType: 'RELATIONSHIP_EVIDENCE',
        observationStage: 'RELATIONSHIP',
        metricType: 'feeder_pipeline',
        reviewAt: new Date(),
        expiresAt: new Date('2027-01-01'),
        metadata: { maxImpactCap: 0.06 },
      });

      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([priorObs, driftObs, relObs]);

      const result = await service.buildActiveSignals(ACTOR_ID, {
        policyVersionId: 'policy-1',
      });

      expect(result.priorsBuilt).toBe(1);
      expect(result.driftSignalsBuilt).toBe(1);
      expect(result.relationshipSignalsBuilt).toBe(1);
    });

    it('should throw ConflictException for APPROVED_FOR_SIGNAL observation missing schoolId', async () => {
      setupBuildSignalsTest();

      const obs = createMockObservation({
        status: 'APPROVED_FOR_SIGNAL',
        schoolId: null, // Missing
        observationStage: 'DRIFT',
        metricType: 'drift',
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([obs]);

      await expect(
        service.buildActiveSignals(ACTOR_ID, {
          policyVersionId: 'policy-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for prior observation missing cohortKey/round', async () => {
      setupBuildSignalsTest();

      const obs = createMockObservation({
        status: 'APPROVED_FOR_PRIOR',
        schoolId: 'school-1',
        cohortKey: null, // Missing
        round: null, // Missing
        admitCount: 50,
        applyCount: 200,
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([obs]);

      await expect(
        service.buildActiveSignals(ACTOR_ID, {
          policyVersionId: 'policy-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for relationship observation missing reviewAt/expiresAt', async () => {
      setupBuildSignalsTest();

      const obs = createMockObservation({
        status: 'APPROVED_FOR_SIGNAL',
        schoolId: 'school-1',
        sourceType: 'RELATIONSHIP_EVIDENCE',
        observationStage: 'RELATIONSHIP',
        metricType: 'partnership',
        reviewAt: null, // Missing
        expiresAt: null, // Missing
        metadata: { maxImpactCap: 0.05 },
      });
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([obs]);

      await expect(
        service.buildActiveSignals(ACTOR_ID, {
          policyVersionId: 'policy-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // P1 — promotePolicyToCandidate
  // =========================================================================

  describe('promotePolicyToCandidate', () => {
    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.promotePolicyToCandidate(ACTOR_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when policy is not DRAFT', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy({ status: 'CANDIDATE' }));

      await expect(
        service.promotePolicyToCandidate(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when signal sets are not built', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(
        createMockPolicy({
          status: 'DRAFT',
          priorSetVersion: null,
          driftSetVersion: null,
          relationshipSetVersion: null,
        }),
      );

      await expect(
        service.promotePolicyToCandidate(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when only some signal sets are built', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(
        createMockPolicy({
          status: 'DRAFT',
          priorSetVersion: 'v1:prior',
          driftSetVersion: null, // missing
          relationshipSetVersion: 'v1:relationship',
        }),
      );

      await expect(
        service.promotePolicyToCandidate(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should update status to CANDIDATE when all preconditions met', async () => {
      const policy = createMockPolicy({
        status: 'DRAFT',
        priorSetVersion: 'v1:prior',
        driftSetVersion: 'v1:drift',
        relationshipSetVersion: 'v1:relationship',
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);

      await service.promotePolicyToCandidate(ACTOR_ID, 'policy-1');

      expect(prisma.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: expect.objectContaining({
          status: 'CANDIDATE',
          notes: expect.stringContaining('candidate-freeze'),
        }),
      });
    });

    it('should write audit log', async () => {
      const policy = createMockPolicy({
        status: 'DRAFT',
        priorSetVersion: 'v1:prior',
        driftSetVersion: 'v1:drift',
        relationshipSetVersion: 'v1:relationship',
      });
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(policy);

      await service.promotePolicyToCandidate(ACTOR_ID, 'policy-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_POLICY_CANDIDATE',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P1 — promotePolicyToShadow
  // =========================================================================

  describe('promotePolicyToShadow', () => {
    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.promotePolicyToShadow(ACTOR_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when policy is not CANDIDATE', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy({ status: 'DRAFT' }));

      await expect(
        service.promotePolicyToShadow(ACTOR_ID, 'policy-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should update status to SHADOW with shadowStartedAt', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy({ status: 'CANDIDATE' }));

      await service.promotePolicyToShadow(ACTOR_ID, 'policy-1');

      expect(prisma.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: expect.objectContaining({
          status: 'SHADOW',
          shadowStartedAt: expect.any(Date),
        }),
      });
    });

    it('should write audit log', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy({ status: 'CANDIDATE' }));

      await service.promotePolicyToShadow(ACTOR_ID, 'policy-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_POLICY_SHADOW',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P1 — createPolicyVersion
  // =========================================================================

  describe('createPolicyVersion', () => {
    it('should create policy in DRAFT status', async () => {
      await service.createPolicyVersion(ACTOR_ID, {
        version: 2,
        name: 'V2 Policy',
      });

      expect(prisma.predictionPolicyVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'DRAFT',
          version: 2,
          name: 'V2 Policy',
          policyKey: 'default',
        }),
      });
    });

    it('should use provided policyKey', async () => {
      await service.createPolicyVersion(ACTOR_ID, {
        version: 1,
        name: 'Custom',
        policyKey: 'experimental',
      });

      expect(prisma.predictionPolicyVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          policyKey: 'experimental',
        }),
      });
    });

    it('should normalize thresholds with defaults', async () => {
      await service.createPolicyVersion(ACTOR_ID, {
        version: 1,
        name: 'Test',
        thresholds: { minShadowPredictions: 500 },
      });

      expect(prisma.predictionPolicyVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          thresholds: expect.objectContaining({
            minShadowPredictions: 500,
            minResolvedLabels: 200, // default preserved
          }),
        }),
      });
    });

    it('should append created-by tag to notes', async () => {
      await service.createPolicyVersion(ACTOR_ID, {
        version: 1,
        name: 'Test',
        notes: 'Initial version',
      });

      expect(prisma.predictionPolicyVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: expect.stringContaining(`[created-by:${ACTOR_ID}]`),
        }),
      });
    });

    it('should write audit log', async () => {
      await service.createPolicyVersion(ACTOR_ID, {
        version: 1,
        name: 'Test',
      });

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_POLICY_CREATE',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P1 — reviewObservation
  // =========================================================================

  describe('reviewObservation', () => {
    it('should throw NotFoundException when observation not found', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.reviewObservation(ACTOR_ID, 'obs-missing', {
          status: 'APPROVED_FOR_SIGNAL',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update observation status', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'obs-1',
        notes: null,
        schoolId: 'school-1',
        cohortKey: null,
        round: null,
        rate: null,
        admitCount: null,
        applyCount: null,
      });

      await service.reviewObservation(ACTOR_ID, 'obs-1', {
        status: 'APPROVED_FOR_SIGNAL',
      });

      expect(prisma.predictionSourceObservation.update).toHaveBeenCalledWith({
        where: { id: 'obs-1' },
        data: expect.objectContaining({
          status: 'APPROVED_FOR_SIGNAL',
          reviewedBy: ACTOR_ID,
        }),
      });
    });

    it('should throw BadRequestException for APPROVED_FOR_PRIOR without required fields', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'obs-1',
        notes: null,
        schoolId: null, // missing
        cohortKey: null, // missing
        round: null, // missing
        rate: null,
        admitCount: null,
        applyCount: null,
      });

      await expect(
        service.reviewObservation(ACTOR_ID, 'obs-1', {
          status: 'APPROVED_FOR_PRIOR',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for APPROVED_FOR_PRIOR without rate data', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'obs-1',
        notes: null,
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        round: 'RD',
        rate: null,
        admitCount: null, // no rate data
        applyCount: null,
      });

      await expect(
        service.reviewObservation(ACTOR_ID, 'obs-1', {
          status: 'APPROVED_FOR_PRIOR',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow APPROVED_FOR_PRIOR when rate data is complete', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'obs-1',
        notes: null,
        schoolId: 'school-1',
        cohortKey: 'CN__CHINA_LOCAL',
        round: 'RD',
        rate: null,
        admitCount: 30,
        applyCount: 100,
      });

      await expect(
        service.reviewObservation(ACTOR_ID, 'obs-1', {
          status: 'APPROVED_FOR_PRIOR',
        }),
      ).resolves.toBeDefined();
    });

    it('should append notes to existing notes', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'obs-1',
        notes: 'original note',
        schoolId: 'school-1',
        cohortKey: null,
        round: null,
        rate: null,
        admitCount: null,
        applyCount: null,
      });

      await service.reviewObservation(ACTOR_ID, 'obs-1', {
        status: 'APPROVED_FOR_SIGNAL',
        notes: 'review note',
      });

      expect(prisma.predictionSourceObservation.update).toHaveBeenCalledWith({
        where: { id: 'obs-1' },
        data: expect.objectContaining({
          notes: 'original note\n\nreview note',
        }),
      });
    });

    it('should write audit log', async () => {
      (
        prisma.predictionSourceObservation.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'obs-1',
        notes: null,
        schoolId: 'school-1',
        cohortKey: null,
        round: null,
        rate: null,
        admitCount: null,
        applyCount: null,
      });

      await service.reviewObservation(ACTOR_ID, 'obs-1', {
        status: 'REJECTED',
      });

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_OBSERVATION_REVIEW',
            status: 'REJECTED',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P1 — updatePolicyShadowMetrics
  // =========================================================================

  describe('updatePolicyShadowMetrics', () => {
    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.updatePolicyShadowMetrics(ACTOR_ID, 'missing', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should merge new metrics into monitoringConfig', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(
        createMockPolicy({ monitoringConfig: { existingKey: 'value' } }),
      );

      await service.updatePolicyShadowMetrics(ACTOR_ID, 'policy-1', {
        aucDelta: 0.02,
      });

      expect(prisma.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: {
          monitoringConfig: expect.objectContaining({
            existingKey: 'value',
            shadowMetrics: { aucDelta: 0.02 },
            shadowMetricsUpdatedBy: ACTOR_ID,
          }),
        },
      });
    });

    it('should write audit log with metric keys', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createMockPolicy());

      await service.updatePolicyShadowMetrics(ACTOR_ID, 'policy-1', {
        aucDelta: 0.05,
        brierDelta: -0.01,
      });

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_POLICY_SHADOW_METRICS_UPDATE',
            keys: ['aucDelta', 'brierDelta'],
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P2 — createObservation
  // =========================================================================

  describe('createObservation', () => {
    it('should create observation with default observedAt', async () => {
      const dto = {
        schoolId: 'school-1',
        metricType: 'acceptance_rate',
        sourceType: 'CDS',
        sourceName: 'Common Data Set',
      };

      const result = await service.createObservation(ACTOR_ID, dto as any);

      expect(prisma.predictionSourceObservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          schoolId: 'school-1',
          observationStage: 'SERVE',
          notes: expect.stringContaining(`[created-by:${ACTOR_ID}]`),
        }),
      });
      expect(result).toBeDefined();
    });

    it('should write audit log after creation', async () => {
      await service.createObservation(ACTOR_ID, {
        schoolId: 'school-1',
        metricType: 'acceptance_rate',
        sourceType: 'CDS',
        sourceName: 'Data Set',
      } as any);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_OBSERVATION_CREATE',
          }),
        }),
      );
    });

    it('should append notes with created-by tag', async () => {
      await service.createObservation(ACTOR_ID, {
        schoolId: 'school-1',
        metricType: 'acceptance_rate',
        sourceType: 'CDS',
        sourceName: 'Data Set',
        notes: 'Custom note',
      } as any);

      expect(prisma.predictionSourceObservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: `Custom note\n\n[created-by:${ACTOR_ID}]`,
        }),
      });
    });
  });

  // =========================================================================
  // P2 — listObservations
  // =========================================================================

  describe('listObservations', () => {
    it('should return paginated results with defaults', async () => {
      const mockItems = [createMockObservation()];
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue(mockItems);
      (prisma.predictionSourceObservation.count as jest.Mock).mockResolvedValue(
        1,
      );

      const result = await service.listObservations({});

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply filter conditions', async () => {
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([]);
      (prisma.predictionSourceObservation.count as jest.Mock).mockResolvedValue(
        0,
      );

      await service.listObservations({
        status: 'RAW',
        sourceType: 'CDS',
        schoolId: 'school-1',
        policyVersionId: 'policy-1',
      });

      expect(prisma.predictionSourceObservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'RAW',
            sourceType: 'CDS',
            schoolId: 'school-1',
            policyVersionId: 'policy-1',
          },
        }),
      );
    });

    it('should calculate correct skip for pagination', async () => {
      (
        prisma.predictionSourceObservation.findMany as jest.Mock
      ).mockResolvedValue([]);
      (prisma.predictionSourceObservation.count as jest.Mock).mockResolvedValue(
        0,
      );

      await service.listObservations({ page: 3, pageSize: 10 });

      expect(prisma.predictionSourceObservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
    });
  });

  // =========================================================================
  // P2 — listPolicyVersions
  // =========================================================================

  describe('listPolicyVersions', () => {
    it('should return paginated results', async () => {
      const mockPolicies = [createMockPolicy()];
      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (prisma.predictionPolicyVersion.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listPolicyVersions({});

      expect(result.items).toEqual(mockPolicies);
      expect(result.total).toBe(1);
    });

    it('should filter by policyKey and status', async () => {
      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      (prisma.predictionPolicyVersion.count as jest.Mock).mockResolvedValue(0);

      await service.listPolicyVersions({
        policyKey: 'default',
        status: 'ACTIVE',
      });

      expect(prisma.predictionPolicyVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { policyKey: 'default', status: 'ACTIVE' },
        }),
      );
    });
  });

  // =========================================================================
  // P2 — listOutcomeLabels & reviewOutcomeLabel (delegates)
  // =========================================================================

  describe('listOutcomeLabels', () => {
    it('should delegate to reportingService.getOutcomeReviewQueue', async () => {
      const query = { page: 1, pageSize: 10 };

      await service.listOutcomeLabels(query);

      expect(reportingService.getOutcomeReviewQueue).toHaveBeenCalledWith(
        query,
      );
    });
  });

  describe('reviewOutcomeLabel', () => {
    it('should delegate to reportingService and write audit log', async () => {
      const dto = { status: 'COUNSELOR_VERIFIED' };

      await service.reviewOutcomeLabel(ACTOR_ID, 'label-1', dto as any);

      expect(reportingService.reviewOutcomeLabel).toHaveBeenCalledWith(
        ACTOR_ID,
        'label-1',
        dto,
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            action: 'PREDICTION_OUTCOME_REVIEW',
            status: 'COUNSELOR_VERIFIED',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // P2 — getActiveSignals
  // =========================================================================

  describe('getActiveSignals', () => {
    it('should return priors, drifts, relationships and counts', async () => {
      (prisma.schoolCohortRoundPrior.findMany as jest.Mock).mockResolvedValue([
        { id: 'prior-1' },
      ]);
      (prisma.schoolCohortRegimeSignal.findMany as jest.Mock).mockResolvedValue(
        [{ id: 'drift-1' }],
      );
      (prisma.schoolRelationshipSignal.findMany as jest.Mock).mockResolvedValue(
        [{ id: 'rel-1' }],
      );
      (prisma.schoolCohortRoundPrior.count as jest.Mock).mockResolvedValue(5);
      (prisma.schoolCohortRegimeSignal.count as jest.Mock).mockResolvedValue(3);
      (prisma.schoolRelationshipSignal.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getActiveSignals({
        policyVersionId: 'policy-1',
      });

      expect(result.priors).toHaveLength(1);
      expect(result.drifts).toHaveLength(1);
      expect(result.relationships).toHaveLength(1);
      expect(result.counts).toEqual({
        priors: 5,
        drifts: 3,
        relationships: 2,
      });
    });

    it('should apply limit from query', async () => {
      (prisma.schoolCohortRoundPrior.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      (prisma.schoolCohortRegimeSignal.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      (prisma.schoolRelationshipSignal.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      (prisma.schoolCohortRoundPrior.count as jest.Mock).mockResolvedValue(0);
      (prisma.schoolCohortRegimeSignal.count as jest.Mock).mockResolvedValue(0);
      (prisma.schoolRelationshipSignal.count as jest.Mock).mockResolvedValue(0);

      await service.getActiveSignals({
        policyVersionId: 'policy-1',
        limit: 5,
      });

      expect(prisma.schoolCohortRoundPrior.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('getAuthorityStats', () => {
    it('aggregates AUTHORITATIVE + PREVIEW + NULL buckets for both tables', async () => {
      (prisma.predictionResult.groupBy as jest.Mock).mockResolvedValue([
        { authority: 'AUTHORITATIVE', _count: { _all: 120 } },
        { authority: 'PREVIEW', _count: { _all: 45 } },
      ]);
      (prisma.predictionSnapshot.groupBy as jest.Mock).mockResolvedValue([
        { authority: 'AUTHORITATIVE', _count: { _all: 80 } },
      ]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getAuthorityStats();

      expect(result.result).toEqual({
        total: 165,
        AUTHORITATIVE: 120,
        PREVIEW: 45,
        NULL: 0,
      });
      expect(result.snapshot).toEqual({
        total: 80,
        AUTHORITATIVE: 80,
        PREVIEW: 0,
        NULL: 0,
      });
      expect(result.invariantChecks.resultNullCount).toBe(0);
      expect(result.invariantChecks.snapshotNullCount).toBe(0);
      expect(result.invariantChecks.previewRowsWithOutcomeLabel).toBe(0);
      expect(result.generatedAt).toBeDefined();
    });

    it('flags NULL authority rows (post-backfill invariant violation)', async () => {
      (prisma.predictionResult.groupBy as jest.Mock).mockResolvedValue([
        { authority: 'AUTHORITATIVE', _count: { _all: 100 } },
        { authority: null, _count: { _all: 3 } },
      ]);
      (prisma.predictionSnapshot.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getAuthorityStats();

      expect(result.result.NULL).toBe(3);
      expect(result.invariantChecks.resultNullCount).toBe(3);
    });

    it('flags PREVIEW rows that somehow acquired outcome labels', async () => {
      (prisma.predictionResult.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.predictionSnapshot.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.predictionResult.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getAuthorityStats();

      expect(result.invariantChecks.previewRowsWithOutcomeLabel).toBe(2);
      // The count should query where authority=PREVIEW with outcome labels —
      // the test here only asserts the value flows through; the SQL shape is
      // enforced by the count mock's first call args:
      expect(prisma.predictionResult.count).toHaveBeenCalledWith({
        where: {
          authority: 'PREVIEW',
          outcomeLabelRecords: { some: {} },
        },
      });
    });
  });

  describe('getDataInventory', () => {
    it('aggregates row counts across every teacher-input table', async () => {
      (prisma.school.count as jest.Mock)
        .mockResolvedValueOnce(150) // total
        .mockResolvedValueOnce(110) // withSat
        .mockResolvedValueOnce(140) // withAdmitRate
        .mockResolvedValueOnce(105); // withBoth
      (prisma.schoolProgram.count as jest.Mock)
        .mockResolvedValueOnce(250) // total
        .mockResolvedValueOnce(200); // withAcceptanceRateEstimate
      (prisma.schoolCalibration.count as jest.Mock).mockResolvedValue(5);
      (prisma.schoolCohortRoundPrior.count as jest.Mock).mockResolvedValue(0);
      (prisma.schoolCohortRegimeSignal.count as jest.Mock).mockResolvedValue(0);
      (prisma.schoolRelationshipSignal.count as jest.Mock).mockResolvedValue(0);
      (prisma.admissionCase.count as jest.Mock)
        .mockResolvedValueOnce(1200) // total
        .mockResolvedValueOnce(800) // verified
        .mockResolvedValueOnce(1000) // approvedForTeacher
        .mockResolvedValueOnce(900) // withGpa11
        .mockResolvedValueOnce(850); // withTestScores
      (prisma.admissionCase.groupBy as jest.Mock).mockResolvedValue([
        { result: 'ADMITTED', _count: { _all: 400 } },
        { result: 'REJECTED', _count: { _all: 600 } },
      ]);
      (prisma.schoolMetric.count as jest.Mock).mockResolvedValue(45);
      (prisma.schoolMetric.findMany as jest.Mock).mockResolvedValue([
        { metricKey: 'applications' },
        { metricKey: 'admissions' },
      ]);

      const result = await service.getDataInventory();

      expect(result.schools).toEqual({
        total: 150,
        withSat: 110,
        withAdmitRate: 140,
        withBoth: 105,
        scorecardReady: 105,
      });
      expect(result.schoolPrograms).toEqual({
        total: 250,
        withAcceptanceRateEstimate: 200,
      });
      expect(result.admissionCases.byResult).toEqual({
        ADMITTED: 400,
        REJECTED: 600,
      });
      expect(result.teacherSignalTables.cohortRoundPriors).toBe(0);
      expect(result.schoolMetrics.distinctKeys).toEqual([
        'applications',
        'admissions',
      ]);
      expect(result.generatedAt).toBeDefined();
    });
  });

  describe('getTrainingReadiness', () => {
    it('reports Tier 0 and "INSUFFICIENT" action when data is near-empty', async () => {
      (
        prisma.predictionOutcomeLabelRecord.count as jest.Mock
      ).mockResolvedValue(0);
      (prisma.admissionCase.count as jest.Mock).mockResolvedValue(10); // far below 50
      (prisma.admissionCase.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrainingReadiness();

      expect(result.totalLabeled).toBe(10);
      expect(result.tier.current).toBe(0);
      expect(result.tier.next?.tier).toBe(1);
      expect(result.tier.next?.samplesNeeded).toBe(40);
      expect(result.recommendedNextAction).toContain('INSUFFICIENT');
    });

    it('reports Tier 2 when total labeled sits at 250', async () => {
      // count is called 3 times: (1) verified labels, (2) approved cases, (3) cases with structured test scores
      (
        prisma.predictionOutcomeLabelRecord.count as jest.Mock
      ).mockResolvedValue(50);
      (prisma.admissionCase.count as jest.Mock)
        .mockResolvedValueOnce(200) // approvedAdmissionCases
        .mockResolvedValueOnce(180); // casesWithStructuredTestScores
      (prisma.admissionCase.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrainingReadiness();

      expect(result.totalLabeled).toBe(250);
      expect(result.tier.current).toBe(2);
      expect(result.tier.next?.tier).toBe(3);
      expect(result.tier.next?.samplesNeeded).toBe(750);
      expect(result.recommendedNextAction).toContain('Tier 2 viable');
    });

    it('counts schools above per-school thresholds from groupBy result', async () => {
      (
        prisma.predictionOutcomeLabelRecord.count as jest.Mock
      ).mockResolvedValue(0);
      (prisma.admissionCase.count as jest.Mock).mockResolvedValue(100);
      (prisma.admissionCase.groupBy as jest.Mock)
        .mockResolvedValueOnce([]) // casesByYear
        .mockResolvedValueOnce([
          { schoolId: 's1', _count: { _all: 60 } },
          { schoolId: 's2', _count: { _all: 25 } },
          { schoolId: 's3', _count: { _all: 12 } },
          { schoolId: 's4', _count: { _all: 8 } },
        ]); // casesBySchool

      const result = await service.getTrainingReadiness();

      expect(result.perSchoolCoverage.schoolsWithAtLeast10Samples).toBe(3);
      expect(result.perSchoolCoverage.schoolsWithAtLeast20Samples).toBe(2);
      expect(result.perSchoolCoverage.schoolsWithAtLeast50Samples).toBe(1);
      expect(result.perSchoolCoverage.schoolsWithAtLeast100Samples).toBe(0);
      expect(result.perSchoolCoverage.totalSchoolsWithAnySample).toBe(4);
    });
  });

  describe('normalizeLegacyCases', () => {
    const mkCase = (
      over: Partial<{
        id: string;
        gpaRange: string | null;
        gpa11: number | null;
        gpaScale: number | null;
        satRange: string | null;
        actRange: string | null;
        toeflRange: string | null;
        testScores: unknown;
      }> = {},
    ) => ({
      id: 'c1',
      gpaRange: null,
      gpa11: null,
      gpaScale: null,
      satRange: null,
      actRange: null,
      toeflRange: null,
      testScores: null,
      ...over,
    });

    it('dryRun=true returns preview + counts without calling update', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mkCase({ gpaRange: '3.7-3.9', satRange: '1500-1550' }),
      ]);

      const result = await service.normalizeLegacyCases({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.scanned).toBe(1);
      expect(result.gpaWritten).toBe(1);
      expect(result.testScoresWritten).toBe(1);
      expect(prisma.admissionCase.update).not.toHaveBeenCalled();
      expect(result.preview).toHaveLength(1);
      expect(result.preview[0].gpa11).toBeCloseTo(3.8, 5);
      expect(result.preview[0].testScores).toEqual([
        {
          type: 'SAT',
          score: 1525,
          confidence: 'range-midpoint',
          source: 'legacy_range_parse',
        },
      ]);
    });

    it('writes gpa11 + gpaScale when range parseable and targets are NULL', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mkCase({ id: 'c1', gpaRange: '3.8' }),
      ]);

      await service.normalizeLegacyCases({ dryRun: false });

      expect(prisma.admissionCase.update).toHaveBeenCalledTimes(1);
      const updateArg = (prisma.admissionCase.update as jest.Mock).mock
        .calls[0][0];
      expect(updateArg.where.id).toBe('c1');
      expect(updateArg.data.gpa11).toBe(3.8);
      expect(updateArg.data.gpaScale).toBe(4.0);
    });

    it('does NOT overwrite existing gpa11 even if gpaRange is present', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        // Prisma WHERE filter would normally exclude this case because
        // gpa11 is non-null, but the findMany mock returns it anyway.
        // The service's own null-guard (`c.gpa11 == null`) must still
        // skip it — this asserts that second layer of defense.
        mkCase({ gpaRange: '3.7-3.9', gpa11: 3.5 }),
      ]);

      await service.normalizeLegacyCases({ dryRun: false });

      // Only the testScores update path writes — GPA path is skipped.
      // Since no testScores in input, no update at all.
      expect(prisma.admissionCase.update).not.toHaveBeenCalled();
    });

    it('builds testScores[] with all three test types when provided', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mkCase({
          satRange: '1500-1550',
          actRange: '32-34',
          toeflRange: '100-110',
        }),
      ]);

      await service.normalizeLegacyCases({ dryRun: false });

      const updateArg = (prisma.admissionCase.update as jest.Mock).mock
        .calls[0][0];
      expect(updateArg.data.testScores).toHaveLength(3);
      const byType = Object.fromEntries(
        (
          updateArg.data.testScores as Array<{ type: string; score: number }>
        ).map((e) => [e.type, e.score]),
      );
      expect(byType.SAT).toBe(1525);
      expect(byType.ACT).toBe(33);
      expect(byType.TOEFL).toBe(105);
    });

    it('skips unparseable legacy strings and records them as parseFailures', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mkCase({ id: 'c1', gpaRange: 'strong' }),
        mkCase({ id: 'c2', satRange: 'high' }),
      ]);

      const result = await service.normalizeLegacyCases({ dryRun: true });

      expect(result.gpaWritten).toBe(0);
      expect(result.testScoresWritten).toBe(0);
      expect(result.parseFailures).toEqual(
        expect.arrayContaining([
          { caseId: 'c1', field: 'gpaRange', value: 'strong' },
          { caseId: 'c2', field: 'satRange', value: 'high' },
        ]),
      );
    });

    it('does not touch testScores when existing value is non-null', async () => {
      // A case that already has testScores set (non-null) must be left
      // alone — we only fill the gap, never second-guess an existing
      // structured array.
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        mkCase({
          satRange: '1500-1550',
          testScores: [
            {
              type: 'SAT',
              score: 1600,
              source: 'counselor_verified',
            },
          ],
        }),
      ]);

      await service.normalizeLegacyCases({ dryRun: false });
      // No update — no fields to fill.
      expect(prisma.admissionCase.update).not.toHaveBeenCalled();
    });
  });

  describe('backfillCohortPriors', () => {
    // Helper: build a minimal admissionCase payload that deriveCohortKeyFromCase
    // accepts. Same shape as the findMany select in the service.
    const mkCase = (
      over: Partial<{
        id: string;
        schoolId: string;
        round: string;
        result: 'ADMITTED' | 'REJECTED';
        nationality: string | null;
        curriculumType: string | null;
        highSchoolType: string | null;
        demographicTags: string[];
      }> = {},
    ) => ({
      id: 'c1',
      schoolId: 's1',
      round: 'RD',
      result: 'ADMITTED' as const,
      nationality: 'US',
      curriculumType: null,
      highSchoolType: null,
      demographicTags: [],
      highSchool: null,
      ...over,
    });

    it('dryRun=true returns preview without writing', async () => {
      const cases = Array.from({ length: 6 }, (_, i) =>
        mkCase({ id: `c${i}`, result: i < 4 ? 'ADMITTED' : 'REJECTED' }),
      );
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(cases);

      const result = await service.backfillCohortPriors({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.scanned).toBe(6);
      expect(result.eligibleBuckets).toBe(1); // all 6 cases in one bucket
      expect(result.written).toBe(0);
      expect(result.updated).toBe(0);
      expect(prisma.schoolCohortRoundPrior.create).not.toHaveBeenCalled();
      expect(prisma.schoolCohortRoundPrior.update).not.toHaveBeenCalled();
      expect(result.preview).toHaveLength(1);
      expect(result.preview[0]).toMatchObject({
        schoolId: 's1',
        cohortKey: 'US__US_HS',
        round: 'RD',
        admits: 4,
        rejects: 2,
      });
    });

    it('drops buckets under MIN_SAMPLES', async () => {
      const cases = [
        mkCase({ id: 'c1', schoolId: 's1', result: 'ADMITTED' }),
        mkCase({ id: 'c2', schoolId: 's1', result: 'REJECTED' }),
        mkCase({ id: 'c3', schoolId: 's1', result: 'ADMITTED' }),
      ];
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(cases);

      const result = await service.backfillCohortPriors({
        dryRun: true,
        minSamples: 5,
      });

      expect(result.bucketsTotal).toBe(1);
      expect(result.eligibleBuckets).toBe(0);
      expect(result.droppedLowSample).toBe(1);
    });

    it('aggregates by (school, cohort, round) — separate rounds stay distinct', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        ...Array.from({ length: 5 }, (_, i) =>
          mkCase({ id: `ed${i}`, round: 'ED', result: 'ADMITTED' }),
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          mkCase({ id: `rd${i}`, round: 'RD', result: 'REJECTED' }),
        ),
      ]);

      const result = await service.backfillCohortPriors({ dryRun: true });

      expect(result.eligibleBuckets).toBe(2);
      const byRound = Object.fromEntries(
        result.preview.map((p) => [p.round, p]),
      );
      expect(byRound.ED.admits).toBe(5);
      expect(byRound.ED.rejects).toBe(0);
      expect(byRound.RD.admits).toBe(0);
      expect(byRound.RD.rejects).toBe(5);
    });

    it('normalizes round to uppercase', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) =>
          mkCase({ id: `c${i}`, round: 'rd', result: 'ADMITTED' }),
        ),
      );
      const result = await service.backfillCohortPriors({ dryRun: true });
      expect(result.preview[0].round).toBe('RD');
    });

    it('writes new SchoolCohortRoundPrior when none exists (dryRun=false)', async () => {
      const cases = Array.from({ length: 5 }, (_, i) =>
        mkCase({ id: `c${i}`, result: 'ADMITTED' }),
      );
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(cases);
      (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.backfillCohortPriors({ dryRun: false });

      expect(result.dryRun).toBe(false);
      expect(result.written).toBe(1);
      expect(result.updated).toBe(0);
      expect(prisma.schoolCohortRoundPrior.create).toHaveBeenCalledTimes(1);
      const createArg = (prisma.schoolCohortRoundPrior.create as jest.Mock).mock
        .calls[0][0];
      expect(createArg.data.schoolId).toBe('s1');
      expect(createArg.data.cohortKey).toBe('US__US_HS');
      expect(createArg.data.round).toBe('RD');
      expect(createArg.data.sampleCount).toBe(5);
      expect(createArg.data.policyVersionId).toBeNull();
      expect(createArg.data.smoothingMethod).toBe('wilson-95');
    });

    it('updates existing prior when findFirst returns one', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) =>
          mkCase({ id: `c${i}`, result: 'ADMITTED' }),
        ),
      );
      (prisma.schoolCohortRoundPrior.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-prior',
      });

      const result = await service.backfillCohortPriors({ dryRun: false });

      expect(result.written).toBe(0);
      expect(result.updated).toBe(1);
      expect(prisma.schoolCohortRoundPrior.update).toHaveBeenCalledTimes(1);
      expect(prisma.schoolCohortRoundPrior.create).not.toHaveBeenCalled();
    });

    it('skipped counters: no cohort (cannot derive) and no round', async () => {
      // A case with no round is skipped by the service's Prisma filter
      // `round: { not: null }`, so it never reaches the loop — meaning
      // `skippedNoRound` counts only cases that pass the filter but have
      // round falsy at the TS level (e.g. empty string). The service's
      // fallthrough branch handles that defensively.
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([
        ...Array.from({ length: 5 }, (_, i) =>
          mkCase({ id: `c${i}`, result: 'ADMITTED' }),
        ),
      ]);

      const result = await service.backfillCohortPriors({ dryRun: true });
      expect(result.skippedNoCohort).toBe(0);
      expect(result.skippedNoRound).toBe(0);
    });
  });
});
