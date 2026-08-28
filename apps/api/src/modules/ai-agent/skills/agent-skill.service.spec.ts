import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentType } from '../types';
import { AgentSkillPolicyService } from './agent-skill-policy.service';
import { AgentSkillService } from './agent-skill.service';

describe('AgentSkillService', () => {
  const policy = new AgentSkillPolicyService();
  let prisma: Record<string, any>;
  let service: AgentSkillService;

  beforeEach(() => {
    prisma = {
      agentRun: { findUnique: jest.fn() },
      agentConfigVersion: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      agentSkillDeployment: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      agentSkillEvaluation: { findFirst: jest.fn() },
      agentSkillSignal: { findMany: jest.fn() },
      agentSkillAudit: { create: jest.fn(), findMany: jest.fn() },
    };
    prisma.$transaction = jest.fn((callback) => callback(prisma));
    service = new AgentSkillService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn((key: string) =>
          [
            'AI_AGENT_SKILLS_V1',
            'AI_AGENT_SKILLS_EVOLUTION_V1',
            'AI_AGENT_SKILLS_AUTO_PUBLISH_V1',
          ].includes(key)
            ? 'true'
            : undefined,
        ),
      } as unknown as ConfigService,
      policy,
    );
  });

  it('exposes the complete protected publication flag chain', async () => {
    prisma.agentSkillDeployment.findMany = jest.fn().mockResolvedValue([]);
    prisma.agentSkillEvaluation.findMany = jest.fn().mockResolvedValue([]);
    prisma.agentSkillSignal.findMany = jest.fn().mockResolvedValue([]);
    prisma.agentSkillAudit.findMany = jest.fn().mockResolvedValue([]);

    await expect(service.getStatus()).resolves.toEqual(
      expect.objectContaining({
        enabled: true,
        evolutionEnabled: true,
        autoPublishEnabled: true,
      }),
    );
  });

  it('resolves the version pinned to the run instead of the latest deployment', async () => {
    const skill = policy.bootstrap(AgentType.SCHOOL);
    skill.allowedTools = ['search_schools'];
    skill.instructions.zh = ['只使用经过工具验证的数据。'];
    prisma.agentRun.findUnique.mockResolvedValue({
      skillVersionId: 'skill-v2',
    });
    prisma.agentConfigVersion.findFirst.mockResolvedValue({
      id: 'skill-v2',
      version: 2,
      value: skill,
      contentHash: policy.hash(skill),
    });

    const resolved = await service.resolveForRun(AgentType.SCHOOL, 'run-1');

    expect(resolved.versionId).toBe('skill-v2');
    expect(resolved.config.tools).toEqual(['search_schools']);
    expect(resolved.config.systemPrompt).toContain('只使用经过工具验证的数据');
    expect(prisma.agentSkillDeployment.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to code configuration when the feature is disabled', async () => {
    const disabled = new AgentSkillService(
      prisma as unknown as PrismaService,
      { get: jest.fn().mockReturnValue('false') } as unknown as ConfigService,
      policy,
    );
    const resolved = await disabled.resolveForRun(AgentType.ESSAY, 'run-1');
    expect(resolved.versionId).toBeUndefined();
    expect(resolved.config.type).toBe(AgentType.ESSAY);
    expect(prisma.agentRun.findUnique).not.toHaveBeenCalled();
  });

  it('refuses a 100% publish without a passed offline evaluation', async () => {
    prisma.agentSkillDeployment.findUnique.mockResolvedValue({
      activeVersionId: 'baseline-v1',
    });
    prisma.agentSkillEvaluation.findFirst.mockResolvedValue(null);
    await expect(
      service.publish(AgentType.PROFILE, 'candidate-v2', 'admin-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('refuses an evaluation produced against a stale baseline', async () => {
    prisma.agentSkillDeployment.findUnique.mockResolvedValue({
      activeVersionId: 'baseline-v3',
    });
    prisma.agentSkillEvaluation.findFirst.mockResolvedValue(null);

    await expect(
      service.publish(AgentType.SCHOOL, 'candidate-v2', 'admin-1'),
    ).rejects.toThrow('against the current baseline');
    expect(prisma.agentSkillEvaluation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ baselineVersionId: 'baseline-v3' }),
      }),
    );
  });

  it('atomically switches 100% to a passed version and keeps an immediate rollback target', async () => {
    prisma.agentSkillEvaluation.findFirst.mockResolvedValue({ id: 'eval-1' });
    prisma.agentConfigVersion.findFirst.mockResolvedValue({
      id: 'candidate-v2',
    });
    prisma.agentSkillDeployment.findUnique.mockResolvedValue({
      activeVersionId: 'baseline-v1',
    });
    prisma.agentSkillDeployment.upsert.mockResolvedValue({
      agentType: 'school',
      activeVersionId: 'candidate-v2',
      previousVersionId: 'baseline-v1',
    });

    await service.publish(AgentType.SCHOOL, 'candidate-v2', 'admin-1');

    expect(prisma.agentConfigVersion.updateMany).toHaveBeenCalledWith({
      where: { configType: 'skill', configKey: 'school', isActive: true },
      data: { isActive: false },
    });
    expect(prisma.agentSkillDeployment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          activeVersionId: 'candidate-v2',
          previousVersionId: 'baseline-v1',
        }),
      }),
    );
    expect(prisma.agentSkillAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PUBLISHED_100_PERCENT' }),
      }),
    );
  });

  it('rolls the active pointer back without changing a running Run pin', async () => {
    prisma.agentSkillDeployment.findUnique.mockResolvedValue({
      activeVersionId: 'candidate-v2',
      previousVersionId: 'baseline-v1',
    });
    prisma.agentConfigVersion.findFirst.mockResolvedValue({
      id: 'baseline-v1',
    });
    prisma.agentSkillDeployment.update.mockResolvedValue({
      activeVersionId: 'baseline-v1',
      previousVersionId: null,
    });

    await service.rollback(AgentType.SCHOOL, 'metric regression', 'monitor');

    expect(prisma.agentSkillDeployment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activeVersionId: 'baseline-v1',
          previousVersionId: null,
        }),
      }),
    );
    expect(prisma.agentRun.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    { activeVersionId: 'new-v3', activatedAt: new Date(0), status: 'ACTIVE' },
    {
      activeVersionId: 'candidate-v2',
      activatedAt: new Date(1000),
      status: 'ACTIVE',
    },
    {
      activeVersionId: 'candidate-v2',
      activatedAt: new Date(0),
      status: 'ROLLED_BACK',
    },
  ])('rejects a stale automatic rollback snapshot: %j', async (current) => {
    prisma.agentSkillDeployment.findUnique.mockResolvedValue({
      ...current,
      previousVersionId: 'baseline-v1',
    });
    await expect(
      service.rollback(AgentType.SCHOOL, 'safety', 'AUTO_MONITOR', {
        versionId: 'candidate-v2',
        activatedAt: new Date(0),
      }),
    ).resolves.toBeNull();
    expect(prisma.agentSkillDeployment.update).not.toHaveBeenCalled();
    expect(prisma.agentConfigVersion.update).not.toHaveBeenCalled();
    expect(prisma.agentSkillAudit.create).not.toHaveBeenCalled();
  });
});
