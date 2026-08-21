import { Test, TestingModule } from '@nestjs/testing';
import { AgentConfigService } from './config.service';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../prisma/prisma.service';

describe('AgentConfigService', () => {
  let service: AgentConfigService;
  let prisma: Record<string, any>;
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      agentConfigVersion: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
    );
    events = { emit: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentConfigService,
        {
          provide: NestConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: events.emit,
            on: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(AgentConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return system config', () => {
    const config = service.getSystemConfig();
    expect(config).toBeDefined();
    expect(config).toHaveProperty('llm');
  });

  it('should return all agent configs', () => {
    const configs = service.getAllAgentConfigs();
    expect(configs).toBeDefined();
    expect(typeof configs).toBe('object');
  });

  it('publishes an Agent config only after its immutable version is persisted', async () => {
    prisma.agentConfigVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 4 });
    prisma.agentConfigVersion.create.mockResolvedValue({ id: 'config-5' });

    const updated = await service.updateAgentConfigWithPersistence(
      'orchestrator' as any,
      { temperature: 0.25 },
      { createdBy: 'admin-1' },
    );

    expect(updated.version).toBe('5');
    expect(updated.temperature).toBe(0.25);
    expect(prisma.agentConfigVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        configType: 'agent',
        configKey: 'orchestrator',
        version: 5,
        isActive: true,
        createdBy: 'admin-1',
      }),
    });
    expect(service.getAgentConfig('orchestrator' as any)).toEqual(updated);
    expect(events.emit).toHaveBeenCalledWith(
      'agent.config.agent.updated',
      expect.objectContaining({ config: updated }),
    );
  });

  it('keeps the previous in-memory config when persistence fails', async () => {
    const before = service.getAgentConfig('orchestrator' as any);
    prisma.$transaction.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.updateAgentConfigWithPersistence('orchestrator' as any, {
        temperature: 1.5,
      }),
    ).rejects.toThrow('database unavailable');

    expect(service.getAgentConfig('orchestrator' as any)).toEqual(before);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('persists system updates before making them visible', async () => {
    prisma.agentConfigVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: 2 });
    prisma.agentConfigVersion.create.mockResolvedValue({ id: 'system-3' });

    const updated = await service.updateSystemConfigWithPersistence(
      {
        features: { ...service.getSystemConfig().features, fastRouting: false },
      },
      { createdBy: 'admin-1' },
    );

    expect(updated.features.fastRouting).toBe(false);
    expect(prisma.agentConfigVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        configType: 'system',
        configKey: 'main',
        version: 3,
        createdBy: 'admin-1',
      }),
    });
  });
});
