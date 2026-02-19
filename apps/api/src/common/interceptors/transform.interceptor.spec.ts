import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let mockSetHeader: jest.Mock;
  let mockRequest: Record<string, unknown>;
  let mockResponse: Record<string, unknown>;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockSetHeader = jest.fn();
    mockRequest = {};
    mockResponse = {
      headersSent: false,
      setHeader: mockSetHeader,
    };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should wrap response data in a success envelope', (done) => {
    const data = { id: 1, name: 'Test' };
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: { id: 1, name: 'Test' },
          meta: expect.objectContaining({
            timestamp: expect.any(String),
          }),
        }),
      );
      done();
    });
  });

  it('should include correlationId in meta when present on request', (done) => {
    mockRequest.correlationId = 'corr-abc-123';
    const data = { ok: true };
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect((result as any).meta.correlationId).toBe('corr-abc-123');
      done();
    });
  });

  it('should omit correlationId from meta when not present on request', (done) => {
    // No correlationId on request
    const data = { ok: true };
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect((result as any).meta).not.toHaveProperty('correlationId');
      done();
    });
  });

  it('should set X-Response-Time header on response', (done) => {
    const data = 'hello';
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.stringMatching(/^\d+ms$/),
      );
      done();
    });
  });

  it('should skip wrapping when headersSent is true', (done) => {
    mockResponse.headersSent = true;
    const data = { raw: 'streaming-data' };
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      // Should return the raw data without wrapping
      expect(result).toEqual({ raw: 'streaming-data' });
      expect((result as any).success).toBeUndefined();
      done();
    });
  });

  it('should not set X-Response-Time header when headersSent is true', (done) => {
    mockResponse.headersSent = true;
    const data = 'sse';
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(mockSetHeader).not.toHaveBeenCalled();
      done();
    });
  });

  it('should include responseTimeMs in meta', (done) => {
    const data = { value: 42 };
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect((result as any).meta.responseTimeMs).toEqual(expect.any(Number));
      expect((result as any).meta.responseTimeMs).toBeGreaterThanOrEqual(0);
      done();
    });
  });

  it('should include a valid ISO timestamp in meta', (done) => {
    const data = {};
    mockCallHandler = { handle: () => of(data) };

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      const timestamp = (result as any).meta.timestamp;
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
      done();
    });
  });
});
