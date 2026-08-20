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
  normalizeToolArguments,
} from './agent-run.service';

describe('AgentRunService', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  let prisma: Record<string, any>;
  let service: AgentRunService;

  beforeEach(() => {
    prisma = {
      agentRun: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      agentApproval: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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
    service = new AgentRunService(prisma as unknown as PrismaService, config);
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
    let approvalStatus = AgentApprovalStatus.APPROVED;
    let runStatus = AgentRunStatus.WAITING_APPROVAL;
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
      approvalStatus = AgentApprovalStatus.EXECUTING;
      return { count: 1 };
    });
    prisma.agentRun.updateMany.mockImplementation(async () => {
      if (runStatus !== AgentRunStatus.WAITING_APPROVAL) return { count: 0 };
      runStatus = AgentRunStatus.RUNNING;
      return { count: 1 };
    });

    const first = await service.claimApproved('user-1', 'run-1');
    const second = await service.claimApproved('user-1', 'run-1');

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);
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

    const jobName = 'agent-run-service-expire-stale-approvals';
    expect(
      moduleRef
        .get(CronRegistryService)
        .list()
        .map((job) => job.name),
    ).toContain(jobName);

    const manifest = JSON.parse(
      readFileSync(
        join(__dirname, '../../../../../../.github/cron-jobs.json'),
        'utf8',
      ),
    ) as { jobs: Array<{ name: string }> };
    expect(manifest.jobs.map((job) => job.name)).toContain(jobName);

    await moduleRef.close();
  });
});
