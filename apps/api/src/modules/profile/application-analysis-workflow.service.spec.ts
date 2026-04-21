import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';

const ACTOR_ID = 'operator-1';

function createPolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    policyKey: 'default',
    version: 'v2.0.0',
    name: 'AA V2',
    description: null,
    status: 'DRAFT',
    analysisVersion: 'application-analysis-v2',
    promptVersion: 'prompt-v2',
    ruleBundleVersion: 'rules-v2',
    thresholds: null,
    rolloutConfig: {},
    monitoringConfig: {},
    notes: null,
    effectiveFrom: null,
    shadowStartedAt: null,
    activatedAt: null,
    activatedBy: null,
    retiredAt: null,
    createdAt: new Date('2026-04-10T00:00:00Z'),
    updatedAt: new Date('2026-04-10T00:00:00Z'),
    ...overrides,
  };
}

function createExperiment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'experiment-1',
    capability: 'RECOURSE',
    version: 'recourse-v1',
    policyVersionId: 'policy-1',
    status: 'DRAFT',
    methodVersion: 'method-v1',
    gateConfig: {},
    rolloutConfig: { canaryPercentage: 5 },
    monitoringConfig: {},
    notes: null,
    shadowStartedAt: null,
    canaryStartedAt: null,
    activatedAt: null,
    retiredAt: null,
    createdBy: ACTOR_ID,
    createdAt: new Date('2026-04-10T00:00:00Z'),
    updatedAt: new Date('2026-04-10T00:00:00Z'),
    ...overrides,
  };
}

function createReplayRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'replay-1',
    analysisVersion: 'application-analysis-v2',
    dataset: 'gold:deterministic:v1',
    status: 'COMPLETED',
    metrics: {
      policyCorrectnessRate: 1,
      weakStateCorrectnessRate: 1,
      fabricatedInsightCount: 0,
      actionabilityMean: 1,
      contractParityPass: true,
      goldPassRate: 1,
    },
    summary: {
      totalCases: 50,
      dataset: 'gold:deterministic:v1',
      mode: 'deterministic',
      commitSha: 'abc123',
      reportPath: 'gold-cases/reports/test.md',
      reportJsonPath: 'gold-cases/reports/test.json',
    },
    failures: [],
    createdAt: new Date('2026-04-10T00:00:00Z'),
    finishedAt: new Date('2026-04-10T00:10:00Z'),
    ...overrides,
  };
}

describe('ApplicationAnalysisWorkflowService', () => {
  let service: ApplicationAnalysisWorkflowService;
  let prisma: PrismaService;
  let redis: RedisService;
  let auditLog: AuditLogService;
  let featureFlagService: FeatureFlagService;

  const tx = {
    applicationAnalysisPolicyVersion: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationAnalysisWorkflowService,
        {
          provide: PrismaService,
          useValue: {
            schoolPolicyEvidence: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn().mockImplementation((args) => ({
                id: 'evidence-1',
                ...args.data,
              })),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
            },
            applicationAnalysisPolicyVersion: {
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
            applicationAnalysisEvaluationRun: {
              create: jest.fn().mockImplementation((args) => ({
                id: 'eval-1',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
            },
            applicationAnalysisExperimentVersion: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn().mockImplementation((args) => ({
                id: 'experiment-new',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            applicationAnalysisExperimentEvaluationRun: {
              create: jest.fn().mockImplementation((args) => ({
                id: 'exp-eval-1',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
            },
            applicationAnalysisExperimentSweepRun: {
              create: jest.fn().mockImplementation((args) => ({
                id: 'sweep-run-1',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(0),
            },
            applicationAnalysisRun: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
              findUnique: jest.fn().mockResolvedValue(null),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
            },
            applicationAnalysisReplayRun: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            applicationAnalysisExposureRecord: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation((args) => ({
                id: 'exposure-1',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                generatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
            },
            applicationAnalysisFeedbackRecord: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn().mockImplementation((args) => ({
                id: 'feedback-1',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
            },
            applicationAnalysisExperimentIncident: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockImplementation((args) => ({
                id: 'incident-1',
                createdAt: new Date('2026-04-10T00:00:00Z'),
                updatedAt: new Date('2026-04-10T00:00:00Z'),
                ...args.data,
              })),
              update: jest.fn().mockImplementation((args) => ({
                id: args.where.id,
                ...args.data,
              })),
            },
            featureFlag: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({}),
              update: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest
              .fn()
              .mockImplementation((fn) =>
                typeof fn === 'function' ? fn(tx) : Promise.all(fn),
              ),
          },
        },
        {
          provide: RedisService,
          useValue: {
            connected: true,
            setNX: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(1),
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
          provide: FeatureFlagService,
          useValue: {
            invalidateCache: jest.fn().mockResolvedValue(undefined),
            isEnabled: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(ApplicationAnalysisWorkflowService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    auditLog = module.get(AuditLogService);
    featureFlagService = module.get(FeatureFlagService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reviews evidence and invalidates applicant caches when evidence becomes approved', async () => {
    (prisma.schoolPolicyEvidence.findUnique as jest.Mock).mockResolvedValue({
      id: 'evidence-1',
      notes: null,
      status: 'UNDER_REVIEW',
    });
    (prisma.schoolPolicyEvidence.update as jest.Mock).mockResolvedValue({
      id: 'evidence-1',
      schoolId: 'school-1',
      status: 'APPROVED',
    });

    const result = await service.reviewEvidence(ACTOR_ID, 'evidence-1', {
      status: 'APPROVED',
    });

    expect(result.status).toBe('APPROVED');
    expect(redis.delByPrefix).toHaveBeenCalledWith('ai:profile-analysis:');
    expect(auditLog.log).toHaveBeenCalled();
  });

  it('promotes a draft policy to candidate and creates a gold-set evaluation', async () => {
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(createPolicy({ status: 'DRAFT' }));
    (
      prisma.applicationAnalysisPolicyVersion.update as jest.Mock
    ).mockResolvedValue(createPolicy({ status: 'CANDIDATE' }));
    (prisma.schoolPolicyEvidence.count as jest.Mock).mockResolvedValue(12);

    const result = await service.promotePolicyToCandidate(ACTOR_ID, 'policy-1');

    expect(result.status).toBe('CANDIDATE');
    expect(prisma.applicationAnalysisEvaluationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          policyVersionId: 'policy-1',
          mode: 'GOLD_SET',
        }),
      }),
    );
  });

  it('blocks gate readiness when no shadow evaluation exists', async () => {
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(createPolicy({ status: 'SHADOW' }));
    (prisma.applicationAnalysisEvaluationRun.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const summary = await service.getPolicyGateSummary('policy-1');

    expect(summary.ready).toBe(false);
    expect(summary.failures).toContain(
      'A completed shadow evaluation is required before activation.',
    );
  });

  it('activates a shadow policy when the gate summary is ready', async () => {
    const policy = createPolicy({ status: 'SHADOW' });
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(policy);
    (prisma.applicationAnalysisEvaluationRun.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: 'eval-shadow',
        metrics: {
          policyCorrectnessRate: 0.97,
          weakStateCorrectnessRate: 0.99,
          fabricatedInsightCount: 0,
          actionabilityMean: 4.4,
          contractParityPass: true,
          webRenderPass: true,
          mobileRenderPass: true,
          journeyPassRate: 1,
          unknownPolicyRate: 0.18,
        },
        policyVersion: {
          id: policy.id,
          policyKey: policy.policyKey,
          version: policy.version,
          status: policy.status,
          analysisVersion: policy.analysisVersion,
        },
      })
      .mockResolvedValueOnce(null);

    const result = await service.activatePolicy(ACTOR_ID, 'policy-1');

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(redis.delByPrefix).toHaveBeenCalledWith('ai:profile-analysis:');
  });

  it('rolls back to the previous retired policy', async () => {
    (prisma.applicationAnalysisPolicyVersion.findFirst as jest.Mock)
      .mockResolvedValueOnce(
        createPolicy({ id: 'active-1', status: 'ACTIVE', version: 'v2.1.0' }),
      )
      .mockResolvedValueOnce(
        createPolicy({ id: 'retired-1', status: 'RETIRED', version: 'v2.0.0' }),
      );

    const result = await service.rollbackPolicy(ACTOR_ID, 'default');

    expect(result.success).toBe(true);
    expect(result.restoredPolicyVersionId).toBe('retired-1');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('throws when activating a non-shadow policy', async () => {
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(createPolicy({ status: 'DRAFT' }));

    await expect(
      service.activatePolicy(ACTOR_ID, 'policy-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when a policy is missing', async () => {
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      service.promotePolicyToShadow(ACTOR_ID, 'missing-policy'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records applicant feedback directly against an analysis run and syncs run metrics', async () => {
    (prisma.applicationAnalysisRun.findFirst as jest.Mock).mockResolvedValue({
      id: 'run-1',
      analysisVersion: 'application-analysis-v2',
    });
    (prisma.applicationAnalysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-1',
      metrics: {
        actionabilityMean: 4.2,
      },
    });
    (
      prisma.applicationAnalysisFeedbackRecord.findMany as jest.Mock
    ).mockResolvedValue([
      {
        applicationAnalysisRunId: 'run-1',
        sentiment: 'HELPFUL',
        category: null,
      },
    ]);

    const result = await service.submitApplicantFeedback('user-1', {
      runId: 'run-1',
      sentiment: 'HELPFUL',
      notes: 'This card was actionable.',
    });

    expect(result.applicationAnalysisRunId).toBe('run-1');
    expect(
      prisma.applicationAnalysisFeedbackRecord.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          applicationAnalysisRunId: 'run-1',
          exposureId: 'run-1',
          sentiment: 'HELPFUL',
        }),
      }),
    );
    expect(prisma.applicationAnalysisRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          metrics: expect.objectContaining({
            applicantFeedbackCount: 1,
            helpfulFeedbackRate: 1,
          }),
        }),
      }),
    );
  });

  it('creates an experiment draft and records audit', async () => {
    const result = await service.createExperimentVersion(ACTOR_ID, {
      capability: 'RECOURSE',
      version: 'recourse-v1',
      methodVersion: 'method-v1',
      policyVersionId: 'policy-1',
    });

    expect(result.capability).toBe('RECOURSE');
    expect(auditLog.log).toHaveBeenCalled();
  });

  it('promotes an experiment to canary and syncs feature flags', async () => {
    (
      prisma.applicationAnalysisExperimentVersion.findUnique as jest.Mock
    ).mockResolvedValue(createExperiment({ status: 'SHADOW' }));
    (
      prisma.applicationAnalysisExperimentEvaluationRun.findFirst as jest.Mock
    ).mockResolvedValue({
      id: 'exp-eval-shadow',
      metrics: {
        unsafeSuggestionRate: 0,
        immutableFeatureViolation: 0,
        actionabilityMean: 4.5,
        schoolPolicyConsistency: 0.98,
        contractParityPass: true,
        webRenderPass: true,
        mobileRenderPass: true,
        journeyPassRate: 1,
      },
      experimentVersion: {
        id: 'experiment-1',
        capability: 'RECOURSE',
        version: 'recourse-v1',
        status: 'SHADOW',
        methodVersion: 'method-v1',
      },
    });
    (
      prisma.applicationAnalysisExperimentVersion.update as jest.Mock
    ).mockResolvedValue(createExperiment({ status: 'CANARY' }));
    (
      prisma.applicationAnalysisExperimentVersion.findMany as jest.Mock
    ).mockResolvedValue([createExperiment({ status: 'CANARY' })]);
    (prisma.schoolPolicyEvidence.count as jest.Mock).mockResolvedValue(12);

    const result = await service.promoteExperimentToCanary(
      ACTOR_ID,
      'experiment-1',
    );

    expect(result.status).toBe('CANARY');
    expect(prisma.featureFlag.create).toHaveBeenCalled();
    expect(featureFlagService.invalidateCache).toHaveBeenCalled();
  });

  it('automatically promotes a ready shadow experiment to canary', async () => {
    (
      prisma.applicationAnalysisExperimentVersion.findMany as jest.Mock
    ).mockResolvedValue([
      createExperiment({
        id: 'experiment-shadow',
        status: 'SHADOW',
      }),
    ]);

    jest
      .spyOn(service, 'refreshExperimentEvaluation')
      .mockResolvedValue({ status: 'COMPLETED' } as never);
    jest.spyOn(service, 'getExperimentGateSummary').mockResolvedValue({
      ready: true,
      thresholds: {},
      latestEvaluation: null,
      metrics: {},
      failures: [],
    });
    const promoteSpy = jest
      .spyOn(service, 'promoteExperimentToCanary')
      .mockResolvedValue(createExperiment({ status: 'CANARY' }) as never);

    const summary = await service.runAutomatedExperimentSweep('system');

    expect(promoteSpy).toHaveBeenCalledWith('system', 'experiment-shadow');
    expect(summary.promotedToCanary).toEqual(['experiment-shadow']);
  });

  it('automatically retires a failed canary experiment', async () => {
    (
      prisma.applicationAnalysisExperimentVersion.findMany as jest.Mock
    ).mockResolvedValue([
      createExperiment({
        id: 'experiment-canary',
        status: 'CANARY',
        canaryStartedAt: new Date('2026-04-08T00:00:00Z'),
      }),
    ]);

    jest
      .spyOn(service, 'refreshExperimentEvaluation')
      .mockResolvedValue({ status: 'FAILED' } as never);
    jest
      .spyOn(service as never, 'computeExperimentLiveSignals')
      .mockResolvedValue({
        exposureCount: 0,
        negativeFeedbackRate: 0,
        policyMismatchRate: 0,
        misleadingUncertaintyRate: 0,
        fairnessConcernRate: 0,
        lowActionabilityRate: 0,
        unsafeRecourseCount: 0,
        uniquePairCount: 0,
        outcomeRegressionDelta: 0,
        outcomeSampleCount: 0,
      } as never);
    jest
      .spyOn(service as never, 'updateExperimentMonitoringState')
      .mockResolvedValue(undefined as never);
    jest.spyOn(service as never, 'createExperimentIncident').mockResolvedValue({
      id: 'incident-1',
      message: 'Evaluation failed.',
    } as never);
    const retireSpy = jest
      .spyOn(service, 'retireExperiment')
      .mockResolvedValue(createExperiment({ status: 'RETIRED' }) as never);

    const summary = await service.runAutomatedExperimentSweep('system');

    expect(retireSpy).toHaveBeenCalledWith(
      'system',
      'experiment-canary',
      'Evaluation failed.',
    );
    expect(summary.retired).toEqual(['experiment-canary']);
  });

  it('allows governance evaluation to complete with fixture evidence in governance mode', async () => {
    (
      prisma.applicationAnalysisPolicyVersion.findMany as jest.Mock
    ).mockResolvedValue([createPolicy()]);
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(createPolicy());
    (prisma.schoolPolicyEvidence.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'evidence-fixture-1',
        metadata: {
          governanceSourceMode: 'fixture',
        },
      },
    ]);
    (
      prisma.applicationAnalysisReplayRun.findFirst as jest.Mock
    ).mockResolvedValue(createReplayRun());

    const result = await service.runGovernanceEvaluationForAnalysisVersion(
      ACTOR_ID,
      'application-analysis-v2',
      {
        allowFixtureEvidence: true,
      },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.counts).toEqual(
      expect.objectContaining({
        approvedEvidenceCount: 1,
        fixtureApprovedEvidenceCount: 1,
        realApprovedEvidenceCount: 0,
        evidenceMode: 'fixture',
        workflowMode: 'governance',
      }),
    );
  });

  it('keeps governance evaluation failed in strict mode when only fixture evidence exists', async () => {
    (
      prisma.applicationAnalysisPolicyVersion.findMany as jest.Mock
    ).mockResolvedValue([createPolicy()]);
    (
      prisma.applicationAnalysisPolicyVersion.findUnique as jest.Mock
    ).mockResolvedValue(createPolicy());
    (prisma.schoolPolicyEvidence.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'evidence-fixture-1',
        metadata: {
          governanceSourceMode: 'fixture',
        },
      },
    ]);
    (
      prisma.applicationAnalysisReplayRun.findFirst as jest.Mock
    ).mockResolvedValue(createReplayRun());

    const result = await service.runGovernanceEvaluationForAnalysisVersion(
      ACTOR_ID,
      'application-analysis-v2',
    );

    expect(result.status).toBe('FAILED');
    expect(result.failures).toContain(
      'No approved real school policy evidence is available yet.',
    );
    expect(result.counts).toEqual(
      expect.objectContaining({
        fixtureApprovedEvidenceCount: 1,
        realApprovedEvidenceCount: 0,
        evidenceMode: 'fixture',
        workflowMode: 'production',
      }),
    );
  });

  it('classifies fixture evidence in evidence listings', async () => {
    (prisma.schoolPolicyEvidence.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'evidence-fixture-1',
        schoolId: 'school-1',
        school: null,
        policyDimension: 'TESTING',
        policyValue: 'BLIND',
        sourceName: 'Fixture pack',
        sourceUrl: null,
        sourcePublishedAt: null,
        sourceQuality: 100,
        status: 'APPROVED',
        reviewedAt: new Date('2026-04-10T00:00:00Z'),
        reviewedBy: 'fixture-runner',
        expiresAt: null,
        notes: null,
        metadata: {
          governanceSourceMode: 'fixture',
        },
        createdAt: new Date('2026-04-10T00:00:00Z'),
        updatedAt: new Date('2026-04-10T00:00:00Z'),
      },
    ]);
    (prisma.schoolPolicyEvidence.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listEvidence({
      page: 1,
      pageSize: 20,
    });

    expect(result.items[0]?.evidenceMode).toBe('fixture');
  });
});
