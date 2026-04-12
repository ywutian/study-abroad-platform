import { Test, TestingModule } from '@nestjs/testing';
import { AgentConfigService } from './config.service';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../prisma/prisma.service';

describe('AgentConfigService', () => {
  let service: AgentConfigService;

  beforeEach(async () => {
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
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            agentConfig: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            agentConfigHistory: {
              create: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
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
});
