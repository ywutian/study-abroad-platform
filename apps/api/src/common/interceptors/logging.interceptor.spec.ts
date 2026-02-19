import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor, maskSensitiveData } from './logging.interceptor';

describe('maskSensitiveData', () => {
  it('should mask the password field', () => {
    const input = { username: 'alice', password: 'secret123' };
    const result = maskSensitiveData(input) as Record<string, unknown>;

    expect(result.password).toBe('[REDACTED]');
    expect(result.username).toBe('alice');
  });

  it('should mask the email field', () => {
    const input = { email: 'alice@example.com', name: 'Alice' };
    const result = maskSensitiveData(input) as Record<string, unknown>;

    expect(result.email).toBe('[REDACTED]');
    expect(result.name).toBe('Alice');
  });

  it('should mask nested sensitive fields', () => {
    const input = {
      user: {
        name: 'Bob',
        credentials: {
          token: 'jwt-abc',
          refreshToken: 'rt-xyz',
        },
      },
    };
    const result = maskSensitiveData(input) as any;

    expect(result.user.name).toBe('Bob');
    expect(result.user.credentials.token).toBe('[REDACTED]');
    expect(result.user.credentials.refreshToken).toBe('[REDACTED]');
  });

  it('should preserve non-sensitive fields', () => {
    const input = { firstName: 'Charlie', age: 25, role: 'admin' };
    const result = maskSensitiveData(input) as Record<string, unknown>;

    expect(result.firstName).toBe('Charlie');
    expect(result.age).toBe(25);
    expect(result.role).toBe('admin');
  });

  it('should handle arrays by masking sensitive items within them', () => {
    const input = [
      { email: 'a@b.com', id: 1 },
      { email: 'c@d.com', id: 2 },
    ];
    const result = maskSensitiveData(input) as any[];

    expect(result).toHaveLength(2);
    expect(result[0].email).toBe('[REDACTED]');
    expect(result[0].id).toBe(1);
    expect(result[1].email).toBe('[REDACTED]');
    expect(result[1].id).toBe(2);
  });

  it('should return null as-is', () => {
    expect(maskSensitiveData(null)).toBeNull();
  });

  it('should return undefined as-is', () => {
    expect(maskSensitiveData(undefined)).toBeUndefined();
  });

  it('should return strings as-is', () => {
    expect(maskSensitiveData('hello')).toBe('hello');
  });

  it('should stop recursion at depth > 5 and return the object as-is', () => {
    const deepObj = { a: { b: { c: { d: { e: { password: 'deep' } } } } } };
    // Start at depth 0, nesting is 5 levels deep for 'password' key => depth will be 5 at the e level
    // At depth 6 (processing password's parent), it should stop
    const result = maskSensitiveData(deepObj) as any;
    // depth 0 -> a, depth 1 -> b, depth 2 -> c, depth 3 -> d, depth 4 -> e, depth 5 -> password
    // At depth 5 processing e's children, the recursive call for password value will be depth 6 -> returns as-is
    // But the key check happens before recursion, so password key still gets redacted at depth 5
    // The function checks depth > 5, so at depth 6 it returns obj as-is
    // Let's test with an explicitly deep structure that exceeds the limit
    const veryDeep = {
      l1: { l2: { l3: { l4: { l5: { l6: { password: 'tooDeep' } } } } } },
    };
    const veryDeepResult = maskSensitiveData(veryDeep) as any;
    // At depth 6 (l6 object), depth > 5, so it returns the raw object
    expect(veryDeepResult.l1.l2.l3.l4.l5.l6.password).toBe('tooDeep');
  });

  it('should perform case-insensitive matching on field names', () => {
    const input = {
      PASSWORD: 'p1',
      Email: 'e@x.com',
      CreditCard: '4111',
      SSN: '123-45-6789',
      apiKey: 'key-123',
    };
    const result = maskSensitiveData(input) as Record<string, unknown>;

    expect(result.PASSWORD).toBe('[REDACTED]');
    expect(result.Email).toBe('[REDACTED]');
    expect(result.CreditCard).toBe('[REDACTED]');
    expect(result.SSN).toBe('[REDACTED]');
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('should mask fields that contain a sensitive field name as a substring', () => {
    const input = {
      userPassword: 'secret',
      parentEmail: 'parent@example.com',
      myToken: 'tok-999',
    };
    const result = maskSensitiveData(input) as Record<string, unknown>;

    expect(result.userPassword).toBe('[REDACTED]');
    expect(result.parentEmail).toBe('[REDACTED]');
    expect(result.myToken).toBe('[REDACTED]');
  });

  it('should return numbers and booleans as-is', () => {
    expect(maskSensitiveData(42)).toBe(42);
    expect(maskSensitiveData(true)).toBe(true);
  });
});

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  function createMockContext(overrides: {
    method?: string;
    url?: string;
    body?: unknown;
    userId?: string;
    statusCode?: number;
  }): ExecutionContext {
    const {
      method = 'GET',
      url = '/test',
      body,
      userId,
      statusCode = 200,
    } = overrides;

    const request: Record<string, unknown> = { method, url, body };
    if (userId) {
      request.user = { id: userId };
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it('should log on successful request', (done) => {
    const context = createMockContext({ method: 'GET', url: '/api/users' });
    const handler: CallHandler = { handle: () => of({ data: 'ok' }) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/users 200'),
        );
        done();
      },
    });
  });

  it('should log error on failed request', (done) => {
    const context = createMockContext({ method: 'POST', url: '/api/auth' });
    const error = { status: 401, message: 'Unauthorized' };
    const handler: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('POST /api/auth 401'),
        );
        done();
      },
    });
  });

  it('should default to 500 status when error has no status', (done) => {
    const context = createMockContext({ method: 'GET', url: '/fail' });
    const error = new Error('Something broke');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('GET /fail 500'),
        );
        done();
      },
    });
  });

  it('should log masked request body in debug mode for POST requests', (done) => {
    process.env.LOG_LEVEL = 'debug';
    const context = createMockContext({
      method: 'POST',
      url: '/api/login',
      body: { username: 'alice', password: 'secret' },
    });
    const handler: CallHandler = { handle: () => of({}) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringContaining('[REDACTED]'),
        );
        // username should be preserved
        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('alice'));
        done();
      },
    });
  });

  it('should not log request body for GET requests even in debug mode', (done) => {
    process.env.LOG_LEVEL = 'debug';
    const context = createMockContext({
      method: 'GET',
      url: '/api/data',
      body: { query: 'something' },
    });
    const handler: CallHandler = { handle: () => of({}) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(debugSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should not log request body when LOG_LEVEL is not debug', (done) => {
    delete process.env.LOG_LEVEL;
    const context = createMockContext({
      method: 'POST',
      url: '/api/data',
      body: { password: 'secret' },
    });
    const handler: CallHandler = { handle: () => of({}) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(debugSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should include userId in log when user is present', (done) => {
    const context = createMockContext({
      method: 'GET',
      url: '/api/me',
      userId: 'user-42',
    });
    const handler: CallHandler = { handle: () => of({}) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('[user-42]'),
        );
        done();
      },
    });
  });

  it('should include duration in the log message', (done) => {
    const context = createMockContext({ method: 'GET', url: '/api/slow' });
    const handler: CallHandler = { handle: () => of({}) };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/\d+ms/));
        done();
      },
    });
  });
});
