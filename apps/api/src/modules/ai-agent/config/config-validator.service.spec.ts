import { Test, TestingModule } from '@nestjs/testing';
import { ConfigValidatorService } from './config-validator.service';
import { ConfigService } from '@nestjs/config';

describe('ConfigValidatorService', () => {
  let service: ConfigValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigValidatorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
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
});
