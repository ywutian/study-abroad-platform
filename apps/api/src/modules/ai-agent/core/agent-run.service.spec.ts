import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AgentApprovalStatus, AgentRunStatus } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CronRegistryService } from '../../../common/cron/cron-registry.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AgentRunService,
  getApprovalFingerprint,
  isAgentRunCheckpoint,
  normalizeToolArguments,
} from './agent-run.service';

describe('AgentRunService', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  let prisma: Record<string, any>;
  let service: AgentRunService;
  let metrics: {
    recordHarnessEvent: jest.Mock;
    recordHarnessCleanup: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      agentRun: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      agentApproval: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      agentEvaluationTrace: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn(async (input: unknown) => {
      if (typeof input === 'function') return input(prisma);
      return Promise.all(input as Promise<unknown>[]);
    });
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_APPROVALS_V1') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    metrics = {
      recordHarnessEvent: jest.fn(),
      recordHarnessCleanup: jest.fn(),
    };
    service = new AgentRunService(
      prisma as unknown as PrismaService,
      config,
      undefined,
      undefined,
      metrics as any,
    );
  });

  it('normalizes nested arguments before producing a stable fingerprint', () => {
    const left = {
      id: 'call',
      name: 'write_tool',
      arguments: { b: 2, a: { z: 1, y: 0 } },
    };
    const right = {
      id: 'other',
      name: 'write_tool',
      arguments: { a: { y: 0, z: 1 }, b: 2 },
    };

    expect(normalizeToolArguments(left.arguments)).toEqual({
      a: { y: 0, z: 1 },
      b: 2,
    });
    expect(getApprovalFingerprint(left)).toBe(getApprovalFingerprint(right));
  });

  it('validates a structured V2 checkpoint without embedding tool results', () => {
    expect(
      isAgentRunCheckpoint({
        version: 2,
        agentType: 'orchestrator',
        locale: 'zh',
        planningContent: '',
        steps: [],
        pendingStepIndex: 0,
        successfulFingerprints: [],
        scheduledCalls: 0,
        supplementalRounds: 0,
        planMs: 1,
        executeMs: 0,
        startedAt: now.toISOString(),
        context: {
          version: 1,
          taskGoal: 'Compare schools',
          constraints: [],
          toolResultRefs: [],
          approvalState: 'none',
          unfinishedSteps: [],
        },
        budget: {
          version: 1,
          maxTokens: 24000,
          maxToolCalls: 16,
          maxSupplementalRounds: 2,
          maxDurationMs: 120000,
        },
        usage: {
          version: 1,
          estimatedTokens: 100,
          toolCalls: 0,
          supplementalRounds: 0,
          elapsedMs: 10,
        },
      }),
    ).toBe(true);
  });

  it('freezes a run budget and persists only redacted evaluation evidence', async () => {
    const contextConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_APPROVALS_V1') return 'true';
        if (key === 'AI_AGENT_CONTEXT_V1') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const sanitizer = {
      sanitizeWithDetails: jest.fn((value: string) => ({
        sanitized: value.replace('test@example.com', '****@****.***'),
        detectedTypes: ['EMAIL'],
        maskedCount: 1,
      })),
    };
    const contextService = new AgentRunService(
      prisma as unknown as PrismaService,
      contextConfig,
      sanitizer as any,
    );
    prisma.agentRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run-1',
      agentType: 'orchestrator',
      budget: { version: 1, maxTokens: 24000 },
      usage: { version: 1, estimatedTokens: 100 },
      contextSummary: { taskGoal: 'Email test@example.com' },
      approvals: [],
      startedAt: now,
      completedAt: new Date(now.getTime() + 50),
    });

    await contextService.createRun({
      userId: 'user-1',
      conversationId: 'conversation-1',
      agentType: 'orchestrator' as any,
    });
    await contextService.completeRun('user-1', 'run-1', {
      message: 'Do not copy this response into the trace',
      agentType: 'orchestrator' as any,
      toolsUsed: ['notify_test@example.com'],
    });

    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budget: expect.objectContaining({ maxTokens: 24000 }),
        }),
      }),
    );
    expect(prisma.agentEvaluationTrace.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          redactedTypes: ['EMAIL'],
          payload: expect.not.objectContaining({ message: expect.anything() }),
        }),
      }),
    );
    expect(
      JSON.stringify(prisma.agentEvaluationTrace.upsert.mock.calls[0][0]),
    ).not.toContain('test@example.com');
  });

  it('freezes a stricter one-shot acceptance budget on the run', async () => {
    const acceptanceBudget = {
      version: 1 as const,
      maxTokens: 1000,
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
      maxDurationMs: 10000,
    };
    const harnessOperations = {
      consumeBudgetOverride: jest.fn().mockResolvedValue(acceptanceBudget),
      recordEvent: jest.fn(),
    };
    const contextConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_APPROVALS_V1') return 'true';
        if (key === 'AI_AGENT_CONTEXT_V1') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const acceptanceService = new AgentRunService(
      prisma as unknown as PrismaService,
      contextConfig,
      undefined,
      undefined,
      metrics as any,
      undefined,
      harnessOperations as any,
    );
    prisma.agentRun.create.mockResolvedValue({ id: 'run-acceptance' });

    await acceptanceService.createRun({
      userId: 'synthetic-1',
      conversationId: 'conversation-1',
      agentType: 'orchestrator' as any,
    });

    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ budget: acceptanceBudget }),
      }),
    );
    expect(harnessOperations.consumeBudgetOverride).toHaveBeenCalledWith(
      'synthetic-1',
    );
  });

  it('atomically persists an approval and moves the run to WAITING_APPROVAL', async () => {
    prisma.agentApproval.findUnique.mockResolvedValue(null);
    prisma.agentRun.findFirst.mockResolvedValue({ id: 'run-1' });
    prisma.agentApproval.create.mockResolvedValue({
      id: 'approval-1',
      runId: 'run-1',
      toolName: 'write_tool',
      arguments: { value: 1 },
      fingerprint: 'fingerprint',
      expiresAt: now,
      status: AgentApprovalStatus.PENDING,
    });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.requestApproval({
      runId: 'run-1',
      userId: 'user-1',
      toolCall: { id: 'call-1', name: 'write_tool', arguments: { value: 1 } },
      checkpoint: {
        version: 1,
        agentType: 'orchestrator' as any,
        locale: 'zh',
        planningContent: '',
        steps: [],
        pendingStepIndex: 0,
        successfulFingerprints: [],
        scheduledCalls: 1,
        supplementalRounds: 0,
        planMs: 1,
        executeMs: 0,
        startedAt: now.toISOString(),
      },
    });

    expect(result.approvalId).toBe('approval-1');
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AgentRunStatus.WAITING_APPROVAL,
        }),
      }),
    );
  });

  it('treats repeated approval as idempotent', async () => {
    prisma.agentRun.findFirst.mockResolvedValue(null);
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 0 });
    prisma.agentApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      runId: 'run-1',
      toolName: 'write_tool',
      arguments: {},
      fingerprint: 'fp',
      expiresAt: now,
      status: AgentApprovalStatus.APPROVED,
    });

    await expect(
      service.approve('user-1', 'run-1', 'approval-1'),
    ).resolves.toEqual(
      expect.objectContaining({ status: AgentApprovalStatus.APPROVED }),
    );
  });

  it('treats a concurrent approval winner as an idempotent retry', async () => {
    prisma.agentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AgentRunStatus.WAITING_APPROVAL,
        currentApprovalId: 'approval-1',
      });
    prisma.agentApproval.findFirst
      .mockResolvedValueOnce({
        id: 'approval-1',
        runId: 'run-1',
        toolName: 'write_tool',
        arguments: {},
        fingerprint: 'fp',
        expiresAt: now,
        status: AgentApprovalStatus.PENDING,
      })
      .mockResolvedValueOnce({
        id: 'approval-1',
        runId: 'run-1',
        toolName: 'write_tool',
        arguments: {},
        fingerprint: 'fp',
        expiresAt: now,
        status: AgentApprovalStatus.APPROVED,
      });
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.approve('user-1', 'run-1', 'approval-1'),
    ).resolves.toEqual(
      expect.objectContaining({ status: AgentApprovalStatus.APPROVED }),
    );
  });

  it('approves only the action currently awaited by the run', async () => {
    prisma.agentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AgentRunStatus.WAITING_APPROVAL,
        currentApprovalId: 'approval-1',
      });
    prisma.agentApproval.findFirst.mockResolvedValue({
      id: 'approval-1',
      runId: 'run-1',
      toolName: 'write_tool',
      arguments: {},
      fingerprint: 'fp',
      expiresAt: now,
      status: AgentApprovalStatus.PENDING,
    });
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.approve('user-1', 'run-1', 'approval-1');

    expect(result.status).toBe(AgentApprovalStatus.APPROVED);
    expect(prisma.agentApproval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: AgentApprovalStatus.PENDING }),
      }),
    );
  });

  it('allows exactly one resume claimant', async () => {
    let approvalStatus: AgentApprovalStatus = AgentApprovalStatus.APPROVED;
    let runStatus: AgentRunStatus = AgentRunStatus.WAITING_APPROVAL;
    const buildRun = () => ({
      id: 'run-1',
      userId: 'user-1',
      status: runStatus,
      currentApprovalId: 'approval-1',
      approvals: [
        {
          id: 'approval-1',
          status: approvalStatus,
          fingerprint: 'fp',
        },
      ],
    });
    prisma.agentRun.findFirst.mockImplementation(
      async (query: { where?: { expiresAt?: unknown } }) =>
        query.where?.expiresAt ? null : buildRun(),
    );
    prisma.agentApproval.updateMany.mockImplementation(async () => {
      if (approvalStatus !== AgentApprovalStatus.APPROVED) return { count: 0 };
      approvalStatus = 'EXECUTING';
      return { count: 1 };
    });
    prisma.agentRun.updateMany.mockImplementation(async () => {
      if (runStatus !== AgentRunStatus.WAITING_APPROVAL) return { count: 0 };
      runStatus = 'RUNNING';
      return { count: 1 };
    });

    const first = await service.claimApproved('user-1', 'run-1');
    const second = await service.claimApproved('user-1', 'run-1');

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);
  });

  it('returns a completed run for reconnect even after currentApprovalId is cleared', async () => {
    prisma.agentRun.findFirst.mockImplementation(
      async (query: { where?: { expiresAt?: unknown } }) =>
        query.where?.expiresAt
          ? null
          : {
              id: 'run-1',
              userId: 'user-1',
              status: AgentRunStatus.COMPLETED,
              currentApprovalId: null,
              result: {
                message: 'Persisted result',
                agentType: 'timeline',
              },
              approvals: [
                {
                  id: 'approval-1',
                  status: AgentApprovalStatus.EXECUTED,
                  fingerprint: 'fp',
                  createdAt: now,
                },
              ],
            },
    );

    const result = await service.claimApproved('user-1', 'run-1');

    expect(result.claimed).toBe(false);
    expect(result.run.status).toBe(AgentRunStatus.COMPLETED);
    expect(result.approval?.status).toBe(AgentApprovalStatus.EXECUTED);
    expect(prisma.agentApproval.updateMany).not.toHaveBeenCalled();
    expect(prisma.agentRun.updateMany).not.toHaveBeenCalled();
  });

  it('rejects cancellation after an approved action starts executing', async () => {
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run-1',
      userId: 'user-1',
      status: AgentRunStatus.RUNNING,
      currentApprovalId: 'approval-1',
      approvals: [
        {
          id: 'approval-1',
          status: AgentApprovalStatus.EXECUTING,
        },
      ],
    });

    await expect(service.cancel('user-1', 'run-1')).rejects.toThrow(
      'Approved action is already executing or has executed',
    );
    expect(prisma.agentRun.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite terminal state or trace when completion loses a race', async () => {
    prisma.agentRun.updateMany.mockResolvedValue({ count: 0 });
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run-1',
      userId: 'user-1',
      status: AgentRunStatus.CANCELLED,
    });

    await expect(
      service.completeRun('user-1', 'run-1', {
        message: 'late result',
        agentType: 'timeline' as any,
      }),
    ).resolves.toBe(false);
    expect(prisma.agentEvaluationTrace.upsert).not.toHaveBeenCalled();
  });

  it('rejects the approval and closes the run in one transaction', async () => {
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'run-1',
        status: AgentRunStatus.CANCELLED,
        approvals: [],
      });

    const run = await service.reject(
      'user-1',
      'run-1',
      'approval-1',
      'No thanks',
    );

    expect(run.status).toBe(AgentRunStatus.CANCELLED);
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'APPROVAL_REJECTED' }),
      }),
    );
  });

  it('fails closed instead of replaying a stale in-flight side effect', async () => {
    prisma.agentRun.findFirst.mockImplementation(
      async (query: { where?: { expiresAt?: unknown } }) =>
        query.where?.expiresAt
          ? null
          : {
              id: 'run-1',
              userId: 'user-1',
              status: AgentRunStatus.RUNNING,
              currentApprovalId: 'approval-1',
              approvals: [
                {
                  id: 'approval-1',
                  status: AgentApprovalStatus.EXECUTING,
                  fingerprint: 'fp',
                  executionStartedAt: new Date(Date.now() - 10 * 60 * 1000),
                },
              ],
            },
    );
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.claimApproved('user-1', 'run-1');

    expect(result.claimed).toBe(false);
    expect(result.run.status).toBe(AgentRunStatus.FAILED);
    expect(prisma.agentApproval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'EXECUTION_OUTCOME_UNKNOWN',
        }),
      }),
    );
  });

  it('does not overwrite a tool success that wins the stale-lease race', async () => {
    const staleApproval = {
      id: 'approval-1',
      runId: 'run-1',
      userId: 'user-1',
      status: AgentApprovalStatus.EXECUTING,
      fingerprint: 'fp',
      executionStartedAt: new Date(Date.now() - 10 * 60 * 1000),
    };
    const executedApproval = {
      ...staleApproval,
      status: AgentApprovalStatus.EXECUTED,
    };
    const runningRun = {
      id: 'run-1',
      userId: 'user-1',
      status: AgentRunStatus.RUNNING,
      currentApprovalId: 'approval-1',
      approvals: [staleApproval],
    };
    prisma.agentRun.findFirst.mockImplementation(
      async (query: { where?: { expiresAt?: unknown }; include?: unknown }) => {
        if (query.where?.expiresAt) return null;
        if (query.include) return runningRun;
        return runningRun;
      },
    );
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 0 });
    prisma.agentApproval.findFirst.mockResolvedValue(executedApproval);

    const result = await service.claimApproved('user-1', 'run-1');

    expect(result.claimed).toBe(false);
    expect(result.approval.status).toBe(AgentApprovalStatus.EXECUTED);
    expect(prisma.agentRun.updateMany).not.toHaveBeenCalled();
  });

  it('does not scan approval tables while the feature is disabled', async () => {
    const disabledConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'false';
        if (key === 'AI_AGENT_APPROVALS_V1') return 'false';
        return fallback;
      }),
    } as unknown as ConfigService;
    const disabledService = new AgentRunService(
      prisma as unknown as PrismaService,
      disabledConfig,
    );

    await disabledService.expireStaleApprovals();

    expect(prisma.agentRun.findMany).not.toHaveBeenCalled();
  });

  it('scopes transport-level failure recovery to the owning user', async () => {
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });

    await service.failRun(
      'user-1',
      'run-1',
      'RESUME_STREAM_ABORTED',
      'resume crashed',
    );

    expect(prisma.agentApproval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          runId: 'run-1',
          userId: 'user-1',
        }),
      }),
    );
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'run-1',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('moves unattended expired approvals and runs to terminal EXPIRED state', async () => {
    prisma.agentRun.findMany.mockResolvedValue([
      { id: 'run-1', userId: 'user-1' },
    ]);
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: AgentRunStatus.WAITING_APPROVAL,
    });
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });

    await service.expireStaleApprovals();

    expect(prisma.agentApproval.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentApprovalStatus.EXPIRED }),
      }),
    );
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentRunStatus.EXPIRED }),
      }),
    );
    expect(metrics.recordHarnessEvent).toHaveBeenCalledWith('run_expired');
  });

  it('expires a stale RUNNING run without touching approval state', async () => {
    prisma.agentRun.findMany.mockResolvedValue([
      { id: 'run-2', userId: 'user-2' },
    ]);
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run-2',
      status: AgentRunStatus.RUNNING,
    });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });

    await service.expireStaleApprovals();

    expect(prisma.agentApproval.updateMany).not.toHaveBeenCalled();
    expect(prisma.agentRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AgentRunStatus.EXPIRED,
          errorCode: 'RUN_EXPIRED',
        }),
      }),
    );
  });

  it('removes retained traces and terminal runs in bounded batches', async () => {
    prisma.agentEvaluationTrace.findMany.mockResolvedValue([
      { id: 'trace-1' },
      { id: 'trace-2' },
    ]);
    prisma.agentEvaluationTrace.deleteMany.mockResolvedValue({ count: 2 });
    prisma.agentRun.findMany.mockResolvedValue([{ id: 'run-old' }]);
    prisma.agentRun.deleteMany.mockResolvedValue({ count: 1 });

    await service.cleanupRetainedData();

    expect(prisma.agentEvaluationTrace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
    expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    expect(metrics.recordHarnessCleanup).toHaveBeenCalledWith('traces', 2);
    expect(metrics.recordHarnessCleanup).toHaveBeenCalledWith('runs', 1);
  });

  it('records token and duration budget exhaustion as stable metrics', async () => {
    prisma.agentApproval.updateMany.mockResolvedValue({ count: 0 });
    prisma.agentRun.updateMany.mockResolvedValue({ count: 1 });

    await service.failRun(
      'user-1',
      'run-token',
      'WORKFLOW_FAILED',
      'AGENT_TOKEN_BUDGET_EXCEEDED',
    );
    await service.failRun(
      'user-1',
      'run-duration',
      'WORKFLOW_FAILED',
      'AGENT_DURATION_BUDGET_EXCEEDED',
    );

    expect(metrics.recordHarnessEvent).toHaveBeenCalledWith(
      'token_budget_exceeded',
    );
    expect(metrics.recordHarnessEvent).toHaveBeenCalledWith(
      'duration_budget_exceeded',
    );
  });

  it('registers the approval expiry job on the production HTTP cron path', async () => {
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_APPROVALS_V1') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        CronRegistryService,
        AgentRunService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    await moduleRef.init();

    const jobNames = moduleRef
      .get(CronRegistryService)
      .list()
      .map((job) => job.name);
    expect(jobNames).toContain('agent-run-service-expire-stale-approvals');
    expect(jobNames).toContain('agent-run-service-cleanup-retained-data');

    const manifest = JSON.parse(
      readFileSync(
        join(__dirname, '../../../../../../.github/cron-jobs.json'),
        'utf8',
      ),
    ) as { jobs: Array<{ name: string }> };
    expect(manifest.jobs.map((job) => job.name)).toContain(
      'agent-run-service-expire-stale-approvals',
    );
    expect(manifest.jobs.map((job) => job.name)).toContain(
      'agent-run-service-cleanup-retained-data',
    );

    await moduleRef.close();
  });
});
