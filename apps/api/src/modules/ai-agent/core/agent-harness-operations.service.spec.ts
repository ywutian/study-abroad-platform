import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentHarnessOperationsService } from './agent-harness-operations.service';

describe('AgentHarnessOperationsService', () => {
  let values: Map<string, string>;
  let hashes: Map<string, Record<string, string>>;
  let redis: Record<string, jest.Mock>;
  let prisma: Record<string, any>;
  let service: AgentHarnessOperationsService;

  beforeEach(() => {
    values = new Map();
    hashes = new Map();
    redis = {
      set: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      get: jest.fn(async (key: string) => values.get(key) ?? null),
      getdel: jest.fn(async (key: string) => {
        const value = values.get(key) ?? null;
        values.delete(key);
        return value;
      }),
      hincrby: jest.fn(async (key: string, field: string, amount: number) => {
        const row = hashes.get(key) ?? {};
        row[field] = String((Number(row[field]) || 0) + amount);
        hashes.set(key, row);
        return Number(row[field]);
      }),
      hgetall: jest.fn(async (key: string) => hashes.get(key) ?? {}),
      expire: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'synthetic-1',
          email: 'agent-harness-20260821003000@example.invalid',
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_ACCEPTANCE_V1') return 'true';
        if (key === 'AI_AGENT_MAX_TOKENS_PER_RUN') return 24000;
        if (key === 'AI_AGENT_MAX_DURATION_MS') return 120000;
        return fallback;
      }),
    } as unknown as ConfigService;
    service = new AgentHarnessOperationsService(
      redis as unknown as RedisService,
      config,
      prisma as unknown as PrismaService,
    );
  });

  it('creates and atomically consumes a one-shot context failure grant', async () => {
    await service.createGrant({
      adminId: 'admin-1',
      targetUserId: 'synthetic-1',
      scenario: 'context_compression_failure',
    });

    await expect(
      service.consumeContextCompressionFailure('synthetic-1'),
    ).resolves.toBe(true);
    await expect(
      service.consumeContextCompressionFailure('synthetic-1'),
    ).resolves.toBe(false);
    expect(redis.getdel).toHaveBeenCalledTimes(2);
  });

  it('allows only budget reductions and returns the frozen override once', async () => {
    await service.createGrant({
      adminId: 'admin-1',
      targetUserId: 'synthetic-1',
      scenario: 'budget_exhaustion',
      maxTokens: 1000,
      maxDurationMs: 10000,
    });

    await expect(service.consumeBudgetOverride('synthetic-1')).resolves.toEqual(
      expect.objectContaining({ maxTokens: 1000, maxDurationMs: 10000 }),
    );
    await expect(
      service.consumeBudgetOverride('synthetic-1'),
    ).resolves.toBeUndefined();

    await expect(
      service.createGrant({
        adminId: 'admin-1',
        targetUserId: 'synthetic-1',
        scenario: 'budget_exhaustion',
        maxTokens: 24000,
        maxDurationMs: 10000,
      }),
    ).rejects.toThrow('stricter than production');
  });

  it('aggregates durable evidence across instances without user content', async () => {
    await service.recordEvent('run_completed');
    await service.recordEvent('run_completed');
    await service.recordEvent('approval_executed');

    const evidence = await service.getEvidence(1);

    expect(evidence.totals).toEqual({
      run_completed: 2,
      approval_executed: 1,
    });
    expect(JSON.stringify(evidence)).not.toContain('synthetic-1');
  });

  it('fails closed when Redis cannot retain the grant', async () => {
    redis.set.mockResolvedValue(undefined);
    redis.get.mockResolvedValue(null);

    await expect(
      service.createGrant({
        adminId: 'admin-1',
        targetUserId: 'synthetic-1',
        scenario: 'context_compression_failure',
      }),
    ).rejects.toThrow('storage is unavailable');
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses to target a non-synthetic user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'real-user',
      email: 'student@example.com',
    });

    await expect(
      service.createGrant({
        adminId: 'admin-1',
        targetUserId: 'real-user',
        scenario: 'context_compression_failure',
      }),
    ).rejects.toThrow('Synthetic target not found');
    expect(redis.set).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
