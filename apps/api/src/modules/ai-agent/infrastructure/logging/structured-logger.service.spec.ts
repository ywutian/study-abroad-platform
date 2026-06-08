import { StructuredLoggerService } from './structured-logger.service';
import { ConfigService } from '@nestjs/config';
import { SanitizerService } from '../../memory/sanitizer.service';

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService;

  beforeEach(() => {
    // The service is @Injectable({ scope: TRANSIENT }); resolving it through
    // Test.createTestingModule().resolve() coupled this unit test to the test
    // container's transient-resolution internals (deps came back undefined on
    // the @nestjs/testing 11.1.x bump). Construct directly with mocked deps —
    // this tests the class behavior and is immune to test-lib version changes.
    const config = {
      get: jest.fn((key: string, def?: unknown) => {
        if (key === 'APP_NAME') return 'test-app';
        if (key === 'NODE_ENV') return 'test';
        if (key === 'LOG_LEVEL') return 'debug';
        if (key === 'LOG_SANITIZE') return 'true';
        return def;
      }),
    } as unknown as ConfigService;
    const sanitizer = {
      sanitize: jest.fn((text: string) => text),
      sanitizeObject: jest.fn((obj: unknown) => obj),
    } as unknown as SanitizerService;
    service = new StructuredLoggerService(config, sanitizer);
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
