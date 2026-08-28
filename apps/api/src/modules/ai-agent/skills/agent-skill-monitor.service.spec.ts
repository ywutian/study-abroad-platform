import { Prisma } from '@prisma/client';
import { AgentSkillMonitorService } from './agent-skill-monitor.service';

function fixture() {
  const activatedAt = new Date(0);
  const prisma = {
    agentSkillDeployment: {
      findMany: jest.fn().mockResolvedValue([
        {
          agentType: 'school',
          activeVersionId: 'v2',
          previousVersionId: 'v1',
          activatedAt,
        },
      ]),
    },
    agentEvaluationTrace: {
      findFirst: jest.fn().mockResolvedValue({ id: 'safety-after-500' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    agentSkillAudit: { count: jest.fn().mockResolvedValue(1) },
    agentSkillSignal: { updateMany: jest.fn() },
  };
  const skills = {
    isEvolutionEnabled: jest.fn().mockReturnValue(true),
    rollback: jest.fn().mockResolvedValue({ activeVersionId: 'v1' }),
  };
  const alerts = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new AgentSkillMonitorService(
    prisma as never,
    skills as never,
    alerts as never,
  );
  return { service, prisma, skills, alerts, activatedAt };
}

describe('AgentSkillMonitorService', () => {
  it('checks persisted safety failures immediately, independently of the 500-row metric sample', async () => {
    const f = fixture();
    await f.service.onSafetyTrace('school', 'v2');
    expect(f.prisma.agentEvaluationTrace.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        skillVersionId: 'v2',
        createdAt: { gte: f.activatedAt },
        OR: expect.arrayContaining([
          {
            payload: {
              path: ['failure', 'errorCode'],
              string_contains: 'PERMISSION',
            },
          },
        ]),
      }),
      select: { id: true },
    });
    expect(f.prisma.agentEvaluationTrace.findMany).not.toHaveBeenCalled();
    expect(f.skills.rollback).toHaveBeenCalledWith(
      'school',
      'Automatic rollback: production safety invariant failed',
      'AUTO_MONITOR',
      { versionId: 'v2', activatedAt: f.activatedAt },
    );
  });

  it('recovers a lost notification using the independent scheduled sweep', async () => {
    const f = fixture();
    expect(await f.service.scheduledMonitor()).toBe(1);
    expect(f.skills.rollback).toHaveBeenCalledTimes(1);
  });

  it('is a no-op with evolution disabled', async () => {
    const f = fixture();
    f.skills.isEvolutionEnabled.mockReturnValue(false);
    expect(await f.service.scheduledMonitor()).toBe(0);
    await f.service.onSafetyTrace('school', 'v2');
    expect(f.prisma.agentSkillDeployment.findMany).not.toHaveBeenCalled();
  });

  it('does not count a stale conditional rollback as successful', async () => {
    const f = fixture();
    f.skills.rollback.mockResolvedValue(null);
    expect(await f.service.monitorAndRollback()).toBe(0);
    expect(f.prisma.agentSkillAudit.count).not.toHaveBeenCalled();
  });

  it('leaves a serializable conflict for the next sweep without a false alert', async () => {
    const f = fixture();
    f.skills.rollback.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('synthetic', {
        code: 'P2034',
        clientVersion: 'synthetic',
      }),
    );
    expect(await f.service.scheduledMonitor()).toBe(0);
    expect(f.alerts.send).not.toHaveBeenCalled();
  });

  it('alerts on storage failure without exposing the error and retries on the next tick', async () => {
    const f = fixture();
    f.prisma.agentEvaluationTrace.findFirst.mockRejectedValueOnce(
      new Error('private synthetic detail'),
    );
    await expect(f.service.scheduledMonitor()).rejects.toThrow(
      'SKILL_MONITOR_FAILED',
    );
    expect(JSON.stringify(f.alerts.send.mock.calls)).not.toContain(
      'private synthetic detail',
    );
    expect(f.alerts.send).toHaveBeenCalledTimes(1);
    expect(await f.service.scheduledMonitor()).toBe(1);
  });

  it('does not fail the caller on immediate check failure, but alerts and retries', async () => {
    const f = fixture();
    f.prisma.agentEvaluationTrace.findFirst.mockRejectedValueOnce(
      new Error('synthetic'),
    );
    await expect(
      f.service.onSafetyTrace('school', 'v2'),
    ).resolves.toBeUndefined();
    expect(f.alerts.send).toHaveBeenCalledTimes(1);
    expect(await f.service.scheduledMonitor()).toBe(1);
  });

  it('uses the latest ordered metric sample when no hard safety failure exists', async () => {
    const f = fixture();
    f.prisma.agentEvaluationTrace.findFirst.mockResolvedValue(null);
    expect(await f.service.scheduledMonitor()).toBe(0);
    expect(f.prisma.agentEvaluationTrace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 500,
      }),
    );
    expect(f.skills.rollback).not.toHaveBeenCalled();
  });

  it.each([
    ['too few samples', 9, 200, 200, 0, 0],
    ['no regression', 10, 100, 100, 0, 0],
    ['token regression', 10, 111, 100, 0, 1],
    ['latency regression', 10, 100, 111, 0, 1],
    ['success regression', 10, 100, 100, 1, 1],
  ])(
    'preserves protected thresholds: %s',
    async (_, count, tokens, latency, failures, expected) => {
      const f = fixture();
      f.prisma.agentEvaluationTrace.findFirst.mockResolvedValue(null);
      const baseline = Array.from({ length: 10 }, () => ({
        outcome: 'COMPLETED',
        payload: { usage: { estimatedTokens: 100 }, elapsedMs: 100 },
      }));
      const current = Array.from({ length: count }, (_, i) => ({
        outcome: i < failures ? 'FAILED' : 'COMPLETED',
        payload: { usage: { estimatedTokens: tokens }, elapsedMs: latency },
      }));
      f.prisma.agentEvaluationTrace.findMany
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(baseline);
      expect(await f.service.scheduledMonitor()).toBe(expected);
      expect(f.skills.rollback).toHaveBeenCalledTimes(expected);
    },
  );

  it('retains repeated-rollback cluster pausing', async () => {
    const f = fixture();
    f.prisma.agentSkillAudit.count.mockResolvedValue(2);
    expect(await f.service.scheduledMonitor()).toBe(1);
    expect(f.prisma.agentSkillSignal.updateMany).toHaveBeenCalledWith({
      where: { agentType: 'school', status: 'PENDING' },
      data: { status: 'PAUSED' },
    });
  });
});
