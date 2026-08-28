import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentEvaluationTraceService } from './agent-evaluation-trace.service';

describe('AgentEvaluationTraceService', () => {
  it('fails startup if evolution is enabled without the immediate safety monitor', () => {
    const service = new AgentEvaluationTraceService(
      {} as never,
      {
        get: () => 'true',
      } as never,
    );
    expect(() => service.onModuleInit()).toThrow(
      'SKILL_MONITOR_NOT_CONFIGURED',
    );
  });

  it('awaits the safety check only after durable trace persistence', async () => {
    let stored = false;
    const monitor = {
      onSafetyTrace: jest.fn(async () => {
        expect(stored).toBe(true);
      }),
    };
    const prisma = {
      agentRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'synthetic-run',
          agentType: 'school',
          skillVersionId: 'v2',
          approvals: [],
          startedAt: new Date(),
          completedAt: new Date(),
        }),
      },
      agentEvaluationTrace: {
        upsert: jest.fn(async () => {
          stored = true;
        }),
      },
    };
    const service = new AgentEvaluationTraceService(
      prisma as never,
      {
        get: () => 'true',
      } as never,
      undefined,
      undefined,
      undefined,
      monitor as never,
    );
    expect(() => service.onModuleInit()).not.toThrow();
    await service.persist(
      'synthetic-user',
      'synthetic-run',
      'FAILED',
      undefined,
      { errorCode: 'PRIVACY_VIOLATION' },
    );
    expect(monitor.onSafetyTrace).toHaveBeenCalledWith('school', 'v2');
    monitor.onSafetyTrace.mockClear();
    await service.persist('synthetic-user', 'synthetic-run', 'COMPLETED');
    expect(monitor.onSafetyTrace).not.toHaveBeenCalled();
  });

  it('stores only bounded, redacted execution evidence', async () => {
    const prisma = {
      agentRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'run-1',
          agentType: 'orchestrator',
          budget: { maxTokens: 24000 },
          usage: { estimatedTokens: 100 },
          contextSummary: {
            constraints: ['private constraint'],
            unfinishedSteps: ['search'],
            toolResultRefs: [
              { toolCallId: 'call-1', toolName: 'search', status: 'success' },
            ],
          },
          approvals: [],
          startedAt: new Date('2026-08-20T00:00:00Z'),
          completedAt: new Date('2026-08-20T00:00:01Z'),
        }),
      },
      agentEvaluationTrace: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const config = {
      get: jest.fn((key: string) =>
        ['AI_AGENT_HARNESS_V1', 'AI_AGENT_CONTEXT_V1'].includes(key)
          ? 'true'
          : undefined,
      ),
    };
    const sanitizer = {
      sanitizeWithDetails: jest.fn((value: string) => ({
        sanitized: value.replace('test@example.com', '****@****.***'),
        detectedTypes: ['EMAIL'],
      })),
    };
    const service = new AgentEvaluationTraceService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      sanitizer as never,
    );

    await service.persist('user-1', 'run-1', 'COMPLETED', {
      message: 'raw response test@example.com',
      agentType: 'orchestrator' as never,
      toolsUsed: ['search'],
      data: {
        workflow: {
          steps: [{ tool: 'search', status: 'success', duration: 10 }],
        },
      },
    });

    expect(prisma.agentEvaluationTrace.upsert).toHaveBeenCalledTimes(1);
    const write = prisma.agentEvaluationTrace.upsert.mock.calls[0][0];
    expect(JSON.stringify(write)).not.toContain('raw response');
    expect(JSON.stringify(write)).not.toContain('private constraint');
    expect(write.create.redactedTypes).toEqual(['EMAIL']);
  });

  it('does nothing when context v1 is disabled', async () => {
    const prisma = {
      agentRun: { findFirst: jest.fn() },
      agentEvaluationTrace: { upsert: jest.fn() },
    };
    const service = new AgentEvaluationTraceService(
      prisma as unknown as PrismaService,
      { get: jest.fn().mockReturnValue('false') } as unknown as ConfigService,
    );

    await service.persist('user-1', 'run-1', 'FAILED');

    expect(prisma.agentRun.findFirst).not.toHaveBeenCalled();
    expect(prisma.agentEvaluationTrace.upsert).not.toHaveBeenCalled();
  });

  it('records and alerts when a redacted trace cannot be persisted', async () => {
    const prisma = {
      agentRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'run-1',
          agentType: 'orchestrator',
          approvals: [],
          startedAt: new Date(),
          completedAt: new Date(),
        }),
      },
      agentEvaluationTrace: {
        upsert: jest.fn().mockRejectedValue(new Error('write failed')),
      },
    };
    const metrics = { recordHarnessEvent: jest.fn() };
    const alerts = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new AgentEvaluationTraceService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn((key: string) =>
          ['AI_AGENT_HARNESS_V1', 'AI_AGENT_CONTEXT_V1'].includes(key)
            ? 'true'
            : undefined,
        ),
      } as unknown as ConfigService,
      undefined,
      metrics as never,
      alerts as never,
    );

    await service.persist('user-1', 'run-1', 'FAILED');
    await Promise.resolve();

    expect(metrics.recordHarnessEvent).toHaveBeenCalledWith(
      'evaluation_trace_persist_failed',
    );
    expect(alerts.send).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: 'ai-agent-evaluation-trace-persist-failed',
      }),
    );
  });
});
