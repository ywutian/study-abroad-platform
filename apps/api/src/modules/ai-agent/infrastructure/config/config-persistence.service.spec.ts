import { InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AgentType } from '../../types';
import { AgentConfig } from './config.service';
import { AgentConfigPersistenceService } from './config-persistence.service';

describe('AgentConfigPersistenceService', () => {
  const current: AgentConfig = {
    type: AgentType.ORCHESTRATOR,
    name: 'Agent',
    description: 'Test agent',
    systemPrompt: 'Help the user',
    tools: [],
    canDelegate: [],
    enabled: true,
    version: '1',
  };

  it('fails closed when configuration persistence has no database', async () => {
    const service = new AgentConfigPersistenceService();

    await expect(
      service.persistAgentConfig(AgentType.ORCHESTRATOR, current, {}),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('persists the immutable version before returning the candidate', async () => {
    const tx = {
      agentConfigVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ version: 3 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'version-4' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<AgentConfig>) =>
          callback(tx),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentConfigPersistenceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = moduleRef.get(AgentConfigPersistenceService);

    const result = await service.persistAgentConfig(
      AgentType.ORCHESTRATOR,
      current,
      { temperature: 0.2 },
      { createdBy: 'admin-1' },
    );

    expect(result).toEqual(
      expect.objectContaining({ version: '4', temperature: 0.2 }),
    );
    expect(tx.agentConfigVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 4,
        isActive: true,
        createdBy: 'admin-1',
      }),
    });

    await moduleRef.close();
  });
});
