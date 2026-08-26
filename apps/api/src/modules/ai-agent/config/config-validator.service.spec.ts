import { Test, TestingModule } from '@nestjs/testing';
import { ConfigValidatorService } from './config-validator.service';
import { ConfigService } from '@nestjs/config';
import { AgentType } from '../types';

describe('ConfigValidatorService', () => {
  let service: ConfigValidatorService;
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn((key: string) => {
      if (key === 'OPENAI_MODEL') return 'deepseek-v4-pro';
      return undefined;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigValidatorService,
        {
          provide: ConfigService,
          useValue: {
            get: configGet,
          },
        },
      ],
    }).compile();

    service = module.get(ConfigValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate all configs and return result', () => {
    const result = service.validateAllConfigs();
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should report config validity status', () => {
    // After onModuleInit runs during compile, validation is cached
    expect(typeof service.isConfigValid()).toBe('boolean');
  });

  it('should return valid agent types', () => {
    const types = service.getValidAgentTypes();
    expect(Array.isArray(types)).toBe(true);
  });

  it('should check tool registration', () => {
    expect(typeof service.isToolRegistered('search_schools')).toBe('boolean');
  });

  it('aligns Agent and reflection models with the configured provider model', () => {
    expect(service.getValidatedConfig(AgentType.SCHOOL)).toEqual(
      expect.objectContaining({
        model: 'deepseek-v4-pro',
        reflectionModel: 'deepseek-v4-pro',
      }),
    );
    expect(service.getValidatedConfig(AgentType.PROFILE)?.model).toBe(
      'deepseek-v4-pro',
    );
  });

  it('preserves the checked-in fallback when OPENAI_MODEL is blank', () => {
    configGet.mockImplementation((key: string) =>
      key === 'OPENAI_MODEL' ? '   ' : undefined,
    );

    expect(service.getValidatedConfig(AgentType.PROFILE)?.model).toBe(
      'gpt-4o-mini',
    );
  });
});
