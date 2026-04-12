import { Test, TestingModule } from '@nestjs/testing';
import { StructuredLoggerService } from './structured-logger.service';
import { ConfigService } from '@nestjs/config';
import { SanitizerService } from '../../memory/sanitizer.service';

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredLoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              if (key === 'APP_NAME') return 'test-app';
              if (key === 'NODE_ENV') return 'test';
              if (key === 'LOG_LEVEL') return 'debug';
              if (key === 'LOG_SANITIZE') return 'true';
              return def;
            }),
          },
        },
        {
          provide: SanitizerService,
          useValue: {
            sanitize: jest.fn((text: string) => text),
            sanitizeObject: jest.fn((obj: any) => obj),
          },
        },
      ],
    }).compile();

    // Transient-scoped service requires resolve()
    service = await module.resolve(StructuredLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log without throwing', () => {
    service.log('test message');
    service.warn('warning message');
    service.debug('debug message');
  });

  it('should log errors with trace', () => {
    service.error('error message', 'stack trace here');
  });

  it('should set and clear context', () => {
    const result = service.setContext({ userId: 'user-1' });
    expect(result).toBe(service);
    service.clearContext();
  });

  it('should create child logger with additional context', () => {
    const child = service.child({ agentType: 'school' });
    expect(child).toBeInstanceOf(StructuredLoggerService);
  });
});
