import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './http-exception.filter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockHost(overrides: {
  url?: string;
  method?: string;
  correlationId?: string;
  headersSent?: boolean;
}) {
  const {
    url = '/test',
    method = 'GET',
    correlationId,
    headersSent = false,
  } = overrides;

  const jsonFn = jest.fn();
  const statusFn = jest.fn().mockReturnValue({ json: jsonFn });

  const request: Record<string, unknown> = { url, method };
  if (correlationId !== undefined) {
    request.correlationId = correlationId;
  }

  const response = {
    status: statusFn,
    json: jsonFn,
    headersSent,
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, request, response, statusFn, jsonFn };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    filter = new AllExceptionsFilter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  // ---- HttpException ---------------------------------------------------

  it('should handle HttpException 400 with a string message', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const exception = new HttpException('Bad input', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = jsonFn.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.path).toBe('/test');
    expect(body.error.timestamp).toBeDefined();
  });

  it('should handle HttpException 404 with an object response', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const exception = new HttpException(
      { message: 'Not found', code: 'CUSTOM_NOT_FOUND' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = jsonFn.mock.calls[0][0];
    expect(body.error.code).toBe('CUSTOM_NOT_FOUND');
    expect(body.error.message).toBe('Not found');
  });

  // ---- Prisma Known Request Errors -------------------------------------

  it('should map Prisma P2002 (unique constraint) to 409 DUPLICATE_ENTRY', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      },
    );

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    const body = jsonFn.mock.calls[0][0];
    expect(body.error.code).toBe('DUPLICATE_ENTRY');
    expect(body.error.message).toContain('email');
  });

  it('should map Prisma P2025 (not found) to 404 NOT_FOUND', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonFn.mock.calls[0][0].error.code).toBe('NOT_FOUND');
  });

  it('should map Prisma P2003 (foreign key) to 400 FOREIGN_KEY_ERROR', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Prisma.PrismaClientKnownRequestError('FK failed', {
      code: 'P2003',
      clientVersion: '5.0.0',
      meta: { field_name: 'schoolId' },
    });

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = jsonFn.mock.calls[0][0];
    expect(body.error.code).toBe('FOREIGN_KEY_ERROR');
    expect(body.error.message).toContain('schoolId');
  });

  it('should map Prisma P1001 (connection error) to 503 DATABASE_UNAVAILABLE', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Prisma.PrismaClientKnownRequestError(
      'Connection refused',
      {
        code: 'P1001',
        clientVersion: '5.0.0',
      },
    );

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonFn.mock.calls[0][0].error.code).toBe('DATABASE_UNAVAILABLE');
  });

  it('should map Prisma P2024 (timeout) to 504 QUERY_TIMEOUT', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Prisma.PrismaClientKnownRequestError('Query timeout', {
      code: 'P2024',
      clientVersion: '5.0.0',
    });

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
    expect(jsonFn.mock.calls[0][0].error.code).toBe('QUERY_TIMEOUT');
  });

  // ---- Other Prisma errors ---------------------------------------------

  it('should handle PrismaClientValidationError as 400 VALIDATION_ERROR', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    // PrismaClientValidationError only accepts a message + clientVersion
    const error = new Prisma.PrismaClientValidationError(
      'Invalid field\nSome detail',
      {
        clientVersion: '5.0.0',
      },
    );

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonFn.mock.calls[0][0].error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle PrismaClientInitializationError as 503 DATABASE_UNAVAILABLE', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Prisma.PrismaClientInitializationError(
      'Cannot connect',
      '5.0.0',
    );

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonFn.mock.calls[0][0].error.code).toBe('DATABASE_UNAVAILABLE');
  });

  // ---- Generic Error ----------------------------------------------------

  it('should handle a generic Error as 500 INTERNAL_ERROR', () => {
    const { host, statusFn, jsonFn } = createMockHost({});
    const error = new Error('something broke');

    filter.catch(error, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = jsonFn.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('something broke');
  });

  it('should mask error details in production for generic Error', () => {
    process.env.NODE_ENV = 'production';
    // Recreate filter so it picks up the new NODE_ENV
    filter = new AllExceptionsFilter();
    const { host, jsonFn } = createMockHost({});

    filter.catch(new Error('secret details'), host);

    expect(jsonFn.mock.calls[0][0].error.message).toBe('Internal server error');
  });

  // ---- Headers already sent ---------------------------------------------

  it('should skip sending response when headers are already sent', () => {
    const { host, statusFn } = createMockHost({ headersSent: true });
    const exception = new HttpException('fail', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(statusFn).not.toHaveBeenCalled();
  });

  // ---- Correlation ID ---------------------------------------------------

  it('should include correlationId in the response when available', () => {
    const { host, jsonFn } = createMockHost({
      correlationId: 'abc-123',
    });

    filter.catch(new Error('boom'), host);

    const body = jsonFn.mock.calls[0][0];
    expect(body.error.correlationId).toBe('abc-123');
  });

  it('should not include correlationId when not set on request', () => {
    const { host, jsonFn } = createMockHost({});

    filter.catch(new Error('boom'), host);

    const body = jsonFn.mock.calls[0][0];
    expect(body.error.correlationId).toBeUndefined();
  });
});
