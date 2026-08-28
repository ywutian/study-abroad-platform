import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AgentType } from '../src/modules/ai-agent/types';
import { AgentSkillPolicyService } from '../src/modules/ai-agent/skills/agent-skill-policy.service';
import { AgentSkillService } from '../src/modules/ai-agent/skills/agent-skill.service';
import { AgentSkillSignalCollector } from '../src/modules/ai-agent/skills/agent-skill-signal-collector.service';
import { AgentSkillMonitorService } from '../src/modules/ai-agent/skills/agent-skill-monitor.service';
import { AlertChannelService } from '../src/modules/ai-agent/infrastructure/alerting/alert-channel.service';

// This suite intentionally injects a database constraint failure; never run it
// against a remote/developer business database, including during cleanup.
const database = new URL(
  process.env.DATABASE_URL ?? 'postgresql://invalid/invalid',
);
if (
  !['localhost', '127.0.0.1', 'postgres'].includes(database.hostname) ||
  !['/skill_reliability', '/studyabroad_test'].includes(database.pathname)
) {
  throw new Error(
    'Skill reliability tests require a dedicated local test database',
  );
}

describe('Skill reliability (real PostgreSQL, synthetic fixtures)', () => {
  const prisma = new PrismaService();
  const userId = randomUUID();
  const conversationId = randomUUID();
  const v1 = randomUUID();
  const v2 = randomUUID();
  const signalAgent = `synthetic-${randomUUID()}`;
  const agentType = AgentType.RESUME;
  const config = new ConfigService({
    AI_AGENT_SKILLS_V1: 'true',
    AI_AGENT_SKILLS_EVOLUTION_V1: 'true',
  });
  const skills = new AgentSkillService(
    prisma,
    config,
    new AgentSkillPolicyService(),
  );
  let activatedAt: Date;

  beforeAll(async () => {
    await prisma.$connect();
    // Never overwrite an existing deployment, even in a developer database.
    if (
      await prisma.agentSkillDeployment.findUnique({ where: { agentType } })
    ) {
      throw new Error(
        'Use an isolated test database without an existing resume deployment',
      );
    }
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.invalid`,
        passwordHash: 'synthetic-not-login-capable',
      },
    });
    await prisma.agentConversation.create({
      data: { id: conversationId, userId },
    });
    await prisma.agentConfigVersion.createMany({
      data: [v1, v2].map((id, i) => ({
        id,
        configType: 'skill',
        configKey: agentType,
        version: Math.floor(Date.now() / 1000) + i,
        value: {},
        isActive: i === 1,
      })),
    });
  });

  afterEach(async () => {
    await prisma.agentRun.deleteMany({ where: { userId } });
    await prisma.agentSkillSignal.deleteMany({
      where: { agentType: signalAgent },
    });
    await prisma.agentSkillAudit.deleteMany({
      where: { versionId: { in: [v1, v2] } },
    });
    await prisma.agentSkillDeployment.deleteMany({
      where: { activeVersionId: { in: [v1, v2] } },
    });
  });

  afterAll(async () => {
    await prisma.agentConversation.deleteMany({
      where: { id: conversationId },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.agentConfigVersion.deleteMany({
      where: { id: { in: [v1, v2] } },
    });
    await prisma.$disconnect();
  });

  async function traces(
    count: number,
    type = signalAgent,
    code = 'SYNTHETIC_FAILURE',
  ) {
    const ids = Array.from({ length: count }, () => randomUUID());
    await prisma.agentRun.createMany({
      data: ids.map((id) => ({
        id,
        userId,
        conversationId,
        agentType: type,
        skillVersionId: v2,
        status: 'FAILED',
      })),
    });
    await prisma.agentEvaluationTrace.createMany({
      data: ids.map((runId) => ({
        runId,
        agentType: type,
        skillVersionId: v2,
        outcome: code ? 'FAILED' : 'COMPLETED',
        payload: code ? { failure: { errorCode: code } } : {},
        redactedTypes: [],
      })),
    });
    return ids;
  }

  async function deployment() {
    activatedAt = new Date(Date.now() - 1000);
    await prisma.agentConfigVersion.updateMany({
      where: { id: { in: [v1, v2] } },
      data: { isActive: false },
    });
    await prisma.agentConfigVersion.update({
      where: { id: v2 },
      data: { isActive: true },
    });
    await prisma.agentSkillDeployment.create({
      data: {
        agentType,
        activeVersionId: v2,
        previousVersionId: v1,
        activatedAt,
      },
    });
  }

  it('consumes 1501 traces exactly once across competing workers and restart', async () => {
    await traces(1501);
    const counts = await Promise.all([
      new AgentSkillSignalCollector(prisma).collectSignals(),
      new AgentSkillSignalCollector(prisma).collectSignals(),
    ]);
    counts.push(await new AgentSkillSignalCollector(prisma).collectSignals());
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1501);
    expect(await new AgentSkillSignalCollector(prisma).collectSignals()).toBe(
      0,
    );
    expect(
      await prisma.agentEvaluationTrace.count({
        where: { agentType: signalAgent, skillSignalConsumedAt: { not: null } },
      }),
    ).toBe(1501);
    expect(
      (
        await prisma.agentSkillSignal.findUniqueOrThrow({
          where: {
            agentType_clusterKey: {
              agentType: signalAgent,
              clusterKey: 'SYNTHETIC_FAILURE',
            },
          },
        })
      ).occurrenceCount,
    ).toBe(1501);
  }, 60000);

  it('rolls back both an increment and the claim when a later signal write fails', async () => {
    const [runId] = await traces(1);
    await prisma.agentEvaluationTrace.update({
      where: { runId },
      data: {
        payload: {
          failure: { errorCode: 'SYNTHETIC_FAILURE' },
          usage: { supplementalRounds: 2 },
        },
      },
    });
    // A fixture-scoped constraint forces failure after the first upsert.
    await prisma.$executeRaw`ALTER TABLE "AgentSkillSignal" ADD CONSTRAINT "synthetic_skill_failure" CHECK (NOT ("agentType" LIKE 'synthetic-%' AND "clusterKey" = 'REPLAN_EXHAUSTED'))`;
    try {
      await expect(
        new AgentSkillSignalCollector(prisma).collectSignals(),
      ).rejects.toThrow();
      expect(
        (
          await prisma.agentEvaluationTrace.findUniqueOrThrow({
            where: { runId },
          })
        ).skillSignalConsumedAt,
      ).toBeNull();
      expect(
        await prisma.agentSkillSignal.count({
          where: { agentType: signalAgent },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRaw`ALTER TABLE "AgentSkillSignal" DROP CONSTRAINT "synthetic_skill_failure"`;
    }
    expect(await new AgentSkillSignalCollector(prisma).collectSignals()).toBe(
      2,
    );
    expect(await new AgentSkillSignalCollector(prisma).collectSignals()).toBe(
      0,
    );
  });

  it('commits one rollback/audit under contention and leaves existing runs pinned', async () => {
    await deployment();
    const [runId] = await traces(1, agentType);
    const expected = { versionId: v2, activatedAt };
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        skills.rollback(
          agentType,
          'Synthetic safety check',
          'AUTO_MONITOR',
          expected,
        ),
      ),
    );
    expect(
      results.filter((r) => r.status === 'fulfilled' && r.value !== null),
    ).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(
          Prisma.PrismaClientKnownRequestError,
        );
        expect(result.reason.code).toBe('P2034');
      }
    }
    expect(
      (
        await prisma.agentSkillDeployment.findUniqueOrThrow({
          where: { agentType },
        })
      ).activeVersionId,
    ).toBe(v1);
    expect(
      await prisma.agentSkillAudit.count({
        where: { versionId: v1, action: 'ROLLED_BACK' },
      }),
    ).toBe(1);
    expect(
      (await prisma.agentRun.findUniqueOrThrow({ where: { id: runId } }))
        .skillVersionId,
    ).toBe(v2);
    expect(
      await skills.rollback(agentType, 'Duplicate', 'AUTO_MONITOR', expected),
    ).toBeNull();
  });

  it('rejects an old observation after the same version is reactivated', async () => {
    await deployment();
    await prisma.agentSkillDeployment.update({
      where: { agentType },
      data: { activatedAt: new Date(activatedAt.getTime() + 1) },
    });
    expect(
      await skills.rollback(agentType, 'Stale activation', 'AUTO_MONITOR', {
        versionId: v2,
        activatedAt,
      }),
    ).toBeNull();
    expect(
      await prisma.agentSkillAudit.count({ where: { versionId: v1 } }),
    ).toBe(0);
  });

  it('finds safety failure outside the latest 500 rows after a lost notification', async () => {
    await deployment();
    const [badRun] = await traces(1, agentType, 'PERMISSION_VIOLATION');
    await prisma.agentEvaluationTrace.update({
      where: { runId: badRun },
      data: { createdAt: activatedAt },
    });
    await traces(501, agentType, '');
    const module = await Test.createTestingModule({
      providers: [
        AgentSkillMonitorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentSkillService, useValue: skills },
        { provide: AlertChannelService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    try {
      expect(
        await module.get(AgentSkillMonitorService).scheduledMonitor(),
      ).toBe(1);
      expect(
        await module.get(AgentSkillMonitorService).scheduledMonitor(),
      ).toBe(0);
      expect(
        await prisma.agentSkillAudit.count({
          where: { versionId: v1, actor: 'AUTO_MONITOR' },
        }),
      ).toBe(1);
    } finally {
      await module.close();
    }
  });
});
