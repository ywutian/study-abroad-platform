import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PredictionPolicyShadowService } from './prediction-policy-shadow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionWorkflowService } from './prediction-workflow.service';
import { PredictionReportingService } from './prediction-reporting.service';

describe('PredictionPolicyShadowService', () => {
  let service: PredictionPolicyShadowService;
  let prisma: PrismaService;
  let workflowService: PredictionWorkflowService;
  let reportingService: PredictionReportingService;

  // ── Helpers ──────────────────────────────────────────────────────

  const createPolicy = (overrides: Record<string, unknown> = {}) => ({
    id: 'policy-1',
    policyKey: 'default',
    status: 'SHADOW',
    activatedAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    monitoringConfig: null,
    ...overrides,
  });

  const createPredictionResult = (
    probability: number,
    canonicalResult: 'ADMITTED' | 'REJECTED' | null,
    eligible: boolean,
    overrides: Record<string, unknown> = {},
  ) => ({
    probability,
    cohortKey: 'CN__CHINA_LOCAL',
    applicationRound: 'RD',
    selectivityBand: 'reach',
    outcomeLabelRecords: canonicalResult
      ? [
          {
            id: `label-${Math.random()}`,
            result: canonicalResult,
            status: 'COUNSELOR_VERIFIED',
            createdAt: new Date('2026-03-01'),
          },
        ]
      : [],
    // Store eligible flag so mock can use it
    _eligible: eligible,
    ...overrides,
  });

  const setupResolveCanonical = () => {
    (reportingService.resolveCanonicalOutcome as jest.Mock).mockImplementation(
      (records: Array<{ result: string }>) => {
        if (!records?.length) {
          return {
            canonicalRecord: null,
            displayRecord: null,
            canonicalOutcomeLabel: 'CENSORED',
            eligibleForCalibration: false,
          };
        }
        const record = records[0];
        return {
          canonicalRecord: record,
          displayRecord: record,
          canonicalOutcomeLabel: record.result,
          eligibleForCalibration: true,
        };
      },
    );
  };

  const setupResolveCanonicalIneligible = () => {
    (reportingService.resolveCanonicalOutcome as jest.Mock).mockReturnValue({
      canonicalRecord: null,
      displayRecord: null,
      canonicalOutcomeLabel: 'CENSORED',
      eligibleForCalibration: false,
    });
  };

  // ── Setup ────────────────────────────────────────────────────────

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionPolicyShadowService,
        {
          provide: PrismaService,
          useValue: {
            predictionPolicyVersion: {
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({}),
            },
            predictionResult: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: PredictionWorkflowService,
          useValue: {
            updatePolicyShadowMetrics: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: PredictionReportingService,
          useValue: {
            resolveCanonicalOutcome: jest.fn().mockReturnValue({
              canonicalRecord: null,
              displayRecord: null,
              canonicalOutcomeLabel: 'CENSORED',
              eligibleForCalibration: false,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(PredictionPolicyShadowService);
    prisma = module.get(PrismaService);
    workflowService = module.get(PredictionWorkflowService);
    reportingService = module.get(PredictionReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── refreshPolicyShadowMetrics ───────────────────────────────────

  describe('refreshPolicyShadowMetrics', () => {
    it('should throw NotFoundException when policy not found', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.refreshPolicyShadowMetrics('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return metrics with zero resolved labels when no predictions exist', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.predictionCount).toBe(0);
      expect(result.resolvedLabels).toBe(0);
      expect(result.overall.auc).toBeNull();
      expect(result.overall.brier).toBeNull();
      expect(result.overall.ece).toBeNull();
      expect(result.overall.logLoss).toBeNull();
    });

    it('should compute metrics for predictions with eligible outcomes', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true),
        createPredictionResult(0.6, 'ADMITTED', true),
        createPredictionResult(0.3, 'REJECTED', true),
        createPredictionResult(0.2, 'REJECTED', true),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.resolvedLabels).toBe(4);
      expect(result.overall.auc).not.toBeNull();
      expect(result.overall.brier).not.toBeNull();
      expect(result.overall.ece).not.toBeNull();
      expect(result.overall.logLoss).not.toBeNull();
      expect(typeof result.overall.auc).toBe('number');
      expect(typeof result.overall.brier).toBe('number');
    });

    it('should return null AUC when all labels are 1 (only admits)', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.9, 'ADMITTED', true),
        createPredictionResult(0.7, 'ADMITTED', true),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.overall.auc).toBeNull();
      expect(result.overall.brier).not.toBeNull();
    });

    it('should return null AUC when all labels are 0 (only rejects)', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.2, 'REJECTED', true),
        createPredictionResult(0.1, 'REJECTED', true),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.overall.auc).toBeNull();
      expect(result.overall.brier).not.toBeNull();
    });

    it('should return zero metrics when all predictions are ineligible', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonicalIneligible();

      const predictions = [
        createPredictionResult(0.5, null, false),
        createPredictionResult(0.6, null, false),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.predictionCount).toBe(2);
      expect(result.resolvedLabels).toBe(0);
      expect(result.overall.auc).toBeNull();
      expect(result.overall.brier).toBeNull();
    });

    it('should compute deltas when baseline policy exists', async () => {
      const shadowPolicy = createPolicy({ id: 'shadow-1' });
      const baselinePolicy = createPolicy({
        id: 'baseline-1',
        status: 'ACTIVE',
      });

      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(shadowPolicy);
      (prisma.predictionPolicyVersion.findFirst as jest.Mock).mockResolvedValue(
        baselinePolicy,
      );
      setupResolveCanonical();

      // Shadow policy predictions
      const shadowPredictions = [
        createPredictionResult(0.8, 'ADMITTED', true),
        createPredictionResult(0.3, 'REJECTED', true),
      ];
      // Baseline policy predictions
      const baselinePredictions = [
        createPredictionResult(0.7, 'ADMITTED', true),
        createPredictionResult(0.4, 'REJECTED', true),
      ];

      (prisma.predictionResult.findMany as jest.Mock)
        .mockResolvedValueOnce(shadowPredictions)
        .mockResolvedValueOnce(baselinePredictions);

      const result = await service.refreshPolicyShadowMetrics('shadow-1');

      expect(result.baseline).not.toBeNull();
      expect(result.baseline!.policyVersionId).toBe('baseline-1');
      expect(typeof result.aucDelta).toBe('number');
      expect(typeof result.brierDelta).toBe('number');
      expect(typeof result.eceDelta).toBe('number');
    });

    it('should return null deltas when no baseline policy exists', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionPolicyVersion.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true),
        createPredictionResult(0.3, 'REJECTED', true),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.baseline).toBeNull();
      expect(result.aucDelta).toBeNull();
      expect(result.brierDelta).toBeNull();
      expect(result.eceDelta).toBeNull();
    });

    it('should return null deltas when baseline has no eligible predictions', async () => {
      const shadowPolicy = createPolicy({ id: 'shadow-1' });
      const baselinePolicy = createPolicy({
        id: 'baseline-1',
        status: 'ACTIVE',
      });

      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(shadowPolicy);
      (prisma.predictionPolicyVersion.findFirst as jest.Mock).mockResolvedValue(
        baselinePolicy,
      );

      // Shadow predictions: eligible
      const shadowPredictions = [
        createPredictionResult(0.8, 'ADMITTED', true),
        createPredictionResult(0.3, 'REJECTED', true),
      ];

      // For shadow call use canonical, for baseline call use ineligible
      let callCount = 0;
      (
        reportingService.resolveCanonicalOutcome as jest.Mock
      ).mockImplementation((records: Array<{ result: string }>) => {
        callCount++;
        // First 2 calls are for shadow policy, rest for baseline
        if (callCount <= 2 && records?.length) {
          return {
            canonicalRecord: records[0],
            displayRecord: records[0],
            canonicalOutcomeLabel: records[0].result,
            eligibleForCalibration: true,
          };
        }
        return {
          canonicalRecord: null,
          displayRecord: null,
          canonicalOutcomeLabel: 'CENSORED',
          eligibleForCalibration: false,
        };
      });

      (prisma.predictionResult.findMany as jest.Mock)
        .mockResolvedValueOnce(shadowPredictions)
        .mockResolvedValueOnce([
          createPredictionResult(0.5, null, false),
          createPredictionResult(0.6, null, false),
        ]);

      const result = await service.refreshPolicyShadowMetrics('shadow-1');

      // Baseline has no eligible -> baseline metrics are all null -> deltas null
      expect(result.aucDelta).toBeNull();
      expect(result.brierDelta).toBeNull();
      expect(result.eceDelta).toBeNull();
    });

    it('should call workflowService.updatePolicyShadowMetrics when actorId is provided', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await service.refreshPolicyShadowMetrics('policy-1', 'user-123');

      expect(workflowService.updatePolicyShadowMetrics).toHaveBeenCalledWith(
        'user-123',
        'policy-1',
        expect.any(Object),
      );
      expect(prisma.predictionPolicyVersion.update).not.toHaveBeenCalled();
    });

    it('should directly update monitoringConfig when actorId is not provided', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await service.refreshPolicyShadowMetrics('policy-1');

      expect(workflowService.updatePolicyShadowMetrics).not.toHaveBeenCalled();
      expect(prisma.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: {
          monitoringConfig: expect.objectContaining({
            shadowMetrics: expect.any(Object),
            shadowMetricsUpdatedAt: expect.any(String),
            shadowMetricsUpdatedBy: 'system',
          }),
        },
      });
    });

    it('should merge with existing monitoringConfig when updating directly', async () => {
      const existingConfig = { someExistingKey: 'existingValue' };
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy({ monitoringConfig: existingConfig }));
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await service.refreshPolicyShadowMetrics('policy-1');

      expect(prisma.predictionPolicyVersion.update).toHaveBeenCalledWith({
        where: { id: 'policy-1' },
        data: {
          monitoringConfig: expect.objectContaining({
            someExistingKey: 'existingValue',
            shadowMetrics: expect.any(Object),
          }),
        },
      });
    });

    it('should handle null monitoringConfig gracefully', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy({ monitoringConfig: null }));
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result).toBeDefined();
      expect(prisma.predictionPolicyVersion.update).toHaveBeenCalled();
    });

    it('should set refreshedBy to actorId when provided', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.refreshPolicyShadowMetrics(
        'policy-1',
        'admin-user',
      );

      expect(result.refreshedBy).toBe('admin-user');
    });

    it('should set refreshedBy to "system" when no actorId', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.refreshedBy).toBe('system');
    });

    it('should track cohort counts for known cohort keys', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true, {
          cohortKey: 'CN__CHINA_LOCAL',
        }),
        createPredictionResult(0.6, 'ADMITTED', true, {
          cohortKey: 'CN__CHINA_INTL',
        }),
        createPredictionResult(0.3, 'REJECTED', true, {
          cohortKey: 'CN__CHINA_LOCAL',
        }),
        createPredictionResult(0.2, 'REJECTED', true, {
          cohortKey: 'CN__OVERSEAS_HS',
        }),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.cohorts).toEqual({
        CN__CHINA_LOCAL: 2,
        CN__CHINA_INTL: 1,
        CN__OVERSEAS_HS: 1,
      });
    });

    it('should not count unknown cohort keys', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true, {
          cohortKey: 'UNKNOWN_COHORT',
        }),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.cohorts).toEqual({
        CN__CHINA_LOCAL: 0,
        CN__CHINA_INTL: 0,
        CN__OVERSEAS_HS: 0,
      });
    });

    it('should use null cohortKey as UNKNOWN', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true, {
          cohortKey: null,
        }),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      // null cohortKey becomes 'UNKNOWN', not in known cohorts
      expect(result.cohorts.CN__CHINA_LOCAL).toBe(0);
    });

    it('should generate buckets grouped by cohort, round, and selectivity band', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true, {
          cohortKey: 'CN__CHINA_LOCAL',
          applicationRound: 'EA',
          selectivityBand: 'reach',
        }),
        createPredictionResult(0.6, 'REJECTED', true, {
          cohortKey: 'CN__CHINA_LOCAL',
          applicationRound: 'EA',
          selectivityBand: 'reach',
        }),
        createPredictionResult(0.5, 'ADMITTED', true, {
          cohortKey: 'CN__CHINA_LOCAL',
          applicationRound: 'RD',
          selectivityBand: 'target',
        }),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.buckets).toHaveLength(2);

      const eaReachBucket = result.buckets.find(
        (b) =>
          b.cohortKey === 'CN__CHINA_LOCAL' &&
          b.round === 'EA' &&
          b.selectivityBand === 'reach',
      );
      expect(eaReachBucket).toBeDefined();
      expect(eaReachBucket!.predictionCount).toBe(2);
      expect(eaReachBucket!.resolvedLabels).toBe(2);
      expect(eaReachBucket!.meanProbability).toBeCloseTo(0.7, 5);
      expect(eaReachBucket!.actualAdmitRate).toBeCloseTo(0.5, 5);
    });

    it('should set fairnessBlocked to false', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.fairnessBlocked).toBe(false);
    });

    it('should include refreshedAt as ISO string', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.refreshedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('should look up baseline with same policyKey and ACTIVE status', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy({ policyKey: 'custom-key' }));
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await service.refreshPolicyShadowMetrics('policy-1');

      expect(prisma.predictionPolicyVersion.findFirst).toHaveBeenCalledWith({
        where: {
          policyKey: 'custom-key',
          status: 'ACTIVE',
          id: { not: 'policy-1' },
        },
        orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
      });
    });

    it('should compute correct delta values', async () => {
      const shadowPolicy = createPolicy({ id: 'shadow-1' });
      const baselinePolicy = createPolicy({
        id: 'baseline-1',
        status: 'ACTIVE',
      });

      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(shadowPolicy);
      (prisma.predictionPolicyVersion.findFirst as jest.Mock).mockResolvedValue(
        baselinePolicy,
      );
      setupResolveCanonical();

      // Shadow: well-calibrated predictions
      const shadowPredictions = [
        createPredictionResult(0.9, 'ADMITTED', true),
        createPredictionResult(0.8, 'ADMITTED', true),
        createPredictionResult(0.2, 'REJECTED', true),
        createPredictionResult(0.1, 'REJECTED', true),
      ];
      // Baseline: poorly calibrated predictions
      const baselinePredictions = [
        createPredictionResult(0.5, 'ADMITTED', true),
        createPredictionResult(0.5, 'ADMITTED', true),
        createPredictionResult(0.5, 'REJECTED', true),
        createPredictionResult(0.5, 'REJECTED', true),
      ];

      (prisma.predictionResult.findMany as jest.Mock)
        .mockResolvedValueOnce(shadowPredictions)
        .mockResolvedValueOnce(baselinePredictions);

      const result = await service.refreshPolicyShadowMetrics('shadow-1');

      // Both shadow and baseline have mixed labels, so AUC is computable
      expect(result.aucDelta).not.toBeNull();
      expect(typeof result.aucDelta).toBe('number');
      // Both brier and ece deltas should be numbers
      expect(typeof result.brierDelta).toBe('number');
      expect(typeof result.eceDelta).toBe('number');
      // Verify delta = current - baseline
      expect(result.aucDelta).toBeCloseTo(
        result.overall.auc! - result.baseline!.metrics!.auc!,
        10,
      );
    });

    it('should handle Decimal-like probability values from Prisma', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true, {
          probability: { valueOf: () => 0.8 },
        }),
        createPredictionResult(0.3, 'REJECTED', true, {
          probability: '0.3',
        }),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.resolvedLabels).toBe(2);
      expect(result.overall.brier).not.toBeNull();
    });

    it('should handle null applicationRound and selectivityBand', async () => {
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      setupResolveCanonical();

      const predictions = [
        createPredictionResult(0.8, 'ADMITTED', true, {
          applicationRound: null,
          selectivityBand: null,
        }),
      ];
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue(
        predictions,
      );

      const result = await service.refreshPolicyShadowMetrics('policy-1');

      expect(result.resolvedLabels).toBe(1);
      // null round defaults to 'RD', null selectivityBand defaults to 'unknown'
      const bucket = result.buckets[0];
      expect(bucket.round).toBe('RD');
      expect(bucket.selectivityBand).toBe('unknown');
    });
  });

  // ── refreshAllShadowPolicies ─────────────────────────────────────

  describe('refreshAllShadowPolicies', () => {
    it('should complete without error when no SHADOW policies exist', async () => {
      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue(
        [],
      );

      await expect(service.refreshAllShadowPolicies()).resolves.not.toThrow();

      expect(prisma.predictionPolicyVersion.findMany).toHaveBeenCalledWith({
        where: { status: 'SHADOW' },
        select: { id: true },
      });
    });

    it('should refresh each SHADOW policy', async () => {
      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue([
        { id: 'shadow-1' },
        { id: 'shadow-2' },
      ]);

      // Each call to refreshPolicyShadowMetrics needs a findUnique result
      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockResolvedValue(createPolicy());
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await service.refreshAllShadowPolicies();

      // findUnique called once per policy
      expect(prisma.predictionPolicyVersion.findUnique).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should continue refreshing remaining policies when one fails', async () => {
      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue([
        { id: 'shadow-1' },
        { id: 'shadow-2' },
        { id: 'shadow-3' },
      ]);

      // First policy: not found -> throws
      // Second and third: found -> succeeds
      (prisma.predictionPolicyVersion.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // shadow-1 not found
        .mockResolvedValueOnce(createPolicy({ id: 'shadow-2' }))
        .mockResolvedValueOnce(createPolicy({ id: 'shadow-3' }));

      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.refreshAllShadowPolicies()).resolves.not.toThrow();

      // Should have attempted all 3
      expect(prisma.predictionPolicyVersion.findUnique).toHaveBeenCalledTimes(
        3,
      );
    });

    it('should isolate errors so one failure does not affect others', async () => {
      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue([
        { id: 'shadow-1' },
        { id: 'shadow-2' },
      ]);

      // First fails, second succeeds
      (prisma.predictionPolicyVersion.findUnique as jest.Mock)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(createPolicy({ id: 'shadow-2' }));

      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.refreshAllShadowPolicies()).resolves.not.toThrow();

      // The second policy should still have been processed
      expect(prisma.predictionPolicyVersion.findUnique).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should process policies sequentially (not in parallel)', async () => {
      const callOrder: string[] = [];

      (prisma.predictionPolicyVersion.findMany as jest.Mock).mockResolvedValue([
        { id: 'shadow-1' },
        { id: 'shadow-2' },
      ]);

      (
        prisma.predictionPolicyVersion.findUnique as jest.Mock
      ).mockImplementation(({ where }: { where: { id: string } }) => {
        callOrder.push(`findUnique-${where.id}`);
        return Promise.resolve(createPolicy({ id: where.id }));
      });

      (prisma.predictionResult.findMany as jest.Mock).mockImplementation(() => {
        callOrder.push('findMany');
        return Promise.resolve([]);
      });

      await service.refreshAllShadowPolicies();

      // shadow-1 should be fully processed before shadow-2 starts
      const firstShadow2Index = callOrder.indexOf('findUnique-shadow-2');
      const findManyBeforeShadow2 = callOrder
        .slice(0, firstShadow2Index)
        .filter((c) => c === 'findMany').length;
      // At least one findMany call for shadow-1 before shadow-2 starts
      expect(findManyBeforeShadow2).toBeGreaterThanOrEqual(1);
    });
  });
});
