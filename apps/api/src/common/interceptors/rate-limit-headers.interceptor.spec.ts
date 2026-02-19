import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { RateLimitHeadersInterceptor } from './rate-limit-headers.interceptor';

describe('RateLimitHeadersInterceptor', () => {
  let interceptor: RateLimitHeadersInterceptor;

  beforeEach(() => {
    interceptor = new RateLimitHeadersInterceptor();
  });

  function createMockContext(rateLimit?: {
    remaining: number;
    limit: number;
    resetIn: number;
    concurrent?: number;
    maxConcurrent?: number;
  }) {
    const request: Record<string, unknown> = {};
    if (rateLimit) {
      request.rateLimit = rateLimit;
    }

    const headers: Record<string, unknown> = {};
    const response = {
      setHeader: jest.fn((key: string, value: unknown) => {
        headers[key] = value;
      }),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, response, headers, request };
  }

  function createHandler(data: unknown = { ok: true }): CallHandler {
    return { handle: () => of(data) };
  }

  // -----------------------------------------------------------------------
  // No rate limit info
  // -----------------------------------------------------------------------
  it('should not set any headers when rateLimit is not on the request', (done) => {
    const { context, response } = createMockContext(undefined);
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).not.toHaveBeenCalled();
        done();
      },
    });
  });

  // -----------------------------------------------------------------------
  // Standard rate limit headers
  // -----------------------------------------------------------------------
  it('should set X-RateLimit-Limit header', (done) => {
    const { context, response } = createMockContext({
      remaining: 95,
      limit: 100,
      resetIn: 60_000,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Limit',
          100,
        );
        done();
      },
    });
  });

  it('should set X-RateLimit-Remaining header', (done) => {
    const { context, response } = createMockContext({
      remaining: 42,
      limit: 100,
      resetIn: 30_000,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Remaining',
          42,
        );
        done();
      },
    });
  });

  it('should clamp X-RateLimit-Remaining to 0 when negative', (done) => {
    const { context, response } = createMockContext({
      remaining: -5,
      limit: 100,
      resetIn: 10_000,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Remaining',
          0,
        );
        done();
      },
    });
  });

  it('should set X-RateLimit-Reset as a Unix timestamp in seconds', (done) => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const resetIn = 60_000; // 60 seconds
    const { context, response } = createMockContext({
      remaining: 50,
      limit: 100,
      resetIn,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        const expectedReset = Math.ceil((now + resetIn) / 1000);
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Reset',
          expectedReset,
        );
        jest.restoreAllMocks();
        done();
      },
    });
  });

  // -----------------------------------------------------------------------
  // All three standard headers together
  // -----------------------------------------------------------------------
  it('should set all three standard rate limit headers', (done) => {
    const { context, response } = createMockContext({
      remaining: 10,
      limit: 50,
      resetIn: 120_000,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Limit',
          50,
        );
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Remaining',
          10,
        );
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Reset',
          expect.any(Number),
        );
        done();
      },
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent headers
  // -----------------------------------------------------------------------
  it('should set X-RateLimit-Concurrent when concurrent is provided', (done) => {
    const { context, response } = createMockContext({
      remaining: 90,
      limit: 100,
      resetIn: 60_000,
      concurrent: 3,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Concurrent',
          3,
        );
        done();
      },
    });
  });

  it('should set X-RateLimit-Concurrent-Max when maxConcurrent is provided', (done) => {
    const { context, response } = createMockContext({
      remaining: 90,
      limit: 100,
      resetIn: 60_000,
      maxConcurrent: 10,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Concurrent-Max',
          10,
        );
        done();
      },
    });
  });

  it('should set both concurrent headers when both are provided', (done) => {
    const { context, response } = createMockContext({
      remaining: 80,
      limit: 100,
      resetIn: 60_000,
      concurrent: 5,
      maxConcurrent: 15,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Concurrent',
          5,
        );
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Concurrent-Max',
          15,
        );
        done();
      },
    });
  });

  it('should not set concurrent headers when concurrent is undefined', (done) => {
    const { context, response } = createMockContext({
      remaining: 80,
      limit: 100,
      resetIn: 60_000,
      // concurrent and maxConcurrent omitted
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        const headerNames = response.setHeader.mock.calls.map(
          (call: [string, unknown]) => call[0],
        );
        expect(headerNames).not.toContain('X-RateLimit-Concurrent');
        expect(headerNames).not.toContain('X-RateLimit-Concurrent-Max');
        done();
      },
    });
  });

  // -----------------------------------------------------------------------
  // Pass-through behavior
  // -----------------------------------------------------------------------
  it('should pass through the response data unchanged', (done) => {
    const responseData = { users: [{ id: 1 }] };
    const { context } = createMockContext({
      remaining: 99,
      limit: 100,
      resetIn: 60_000,
    });
    const handler: CallHandler = { handle: () => of(responseData) };

    interceptor.intercept(context, handler).subscribe({
      next: (value) => {
        expect(value).toEqual(responseData);
      },
      complete: done,
    });
  });

  it('should pass through when there is no rateLimit info', (done) => {
    const responseData = { message: 'hello' };
    const { context } = createMockContext(undefined);
    const handler: CallHandler = { handle: () => of(responseData) };

    interceptor.intercept(context, handler).subscribe({
      next: (value) => {
        expect(value).toEqual(responseData);
      },
      complete: done,
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it('should handle remaining = 0', (done) => {
    const { context, response } = createMockContext({
      remaining: 0,
      limit: 100,
      resetIn: 60_000,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Remaining',
          0,
        );
        done();
      },
    });
  });

  it('should handle concurrent = 0', (done) => {
    const { context, response } = createMockContext({
      remaining: 100,
      limit: 100,
      resetIn: 60_000,
      concurrent: 0,
    });
    const handler = createHandler();

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Concurrent',
          0,
        );
        done();
      },
    });
  });
});
