import { PrismaService } from '../../../prisma/prisma.service';
import { AgentSkillEvolutionService } from './agent-skill-evolution.service';

describe('AgentSkillEvolutionService', () => {
  it('is a no-op when evolution is disabled', async () => {
    const service = new AgentSkillEvolutionService(
      {} as PrismaService,
      { isEvolutionEnabled: jest.fn().mockReturnValue(false) } as any,
      {} as any,
      {} as never,
      {} as never,
    );
    await expect(service.runCycle()).resolves.toEqual({
      signalsCollected: 0,
      candidatesCreated: 0,
      published: 0,
      rolledBack: 0,
    });
  });

  it('closes generation, evaluation, direct publish, and audit in one bounded cycle', async () => {
    const signal = {
      id: 'signal-1',
      agentType: 'school',
      clusterKey: 'WRONG_TOOL',
      signalType: 'WRONG_TOOL',
      occurrenceCount: 3,
      payload: { traceIds: ['trace-1', 'trace-2', 'trace-3'], attempt: 0 },
    };
    const prisma: Record<string, any> = {
      agentEvaluationTrace: { findMany: jest.fn().mockResolvedValue([]) },
      agentSkillDeployment: { findMany: jest.fn().mockResolvedValue([]) },
      agentSkillSignal: {
        findMany: jest.fn().mockResolvedValue([signal]),
        update: jest.fn().mockResolvedValue({}),
      },
      agentSkillAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    const skills = {
      isEvolutionEnabled: jest.fn().mockReturnValue(true),
      isAutoPublishEnabled: jest.fn().mockReturnValue(true),
      createCandidate: jest.fn().mockResolvedValue({ id: 'candidate-v2' }),
      publish: jest.fn().mockResolvedValue({}),
    };
    const evaluations = {
      evaluate: jest.fn().mockResolvedValue({ passed: true }),
    };
    const service = new AgentSkillEvolutionService(
      prisma as unknown as PrismaService,
      skills as any,
      evaluations as any,
      { collectSignals: jest.fn().mockResolvedValue(0) } as never,
      { monitorAndRollback: jest.fn().mockResolvedValue(0) } as never,
    );

    await expect(service.runCycle()).resolves.toEqual({
      signalsCollected: 0,
      candidatesCreated: 1,
      published: 1,
      rolledBack: 0,
    });
    expect(skills.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'school',
        source: 'AUTO_EVOLUTION',
      }),
    );
    expect(evaluations.evaluate).toHaveBeenCalledWith({
      agentType: 'school',
      candidateVersionId: 'candidate-v2',
      targetSignalType: 'WRONG_TOOL',
    });
    expect(skills.publish).toHaveBeenCalledWith(
      'school',
      'candidate-v2',
      'AUTO_EVOLUTION',
    );
    expect(prisma.agentSkillAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentType: 'system',
        action: 'EVOLUTION_CYCLE_COMPLETED',
        metadata: expect.objectContaining({ published: 1 }),
      }),
    });
  });
});
