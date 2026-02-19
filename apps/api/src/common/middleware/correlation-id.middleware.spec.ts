import {
  CorrelationIdMiddleware,
  CORRELATION_ID_HEADER,
} from './correlation-id.middleware';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  function createMocks(headerValue?: string) {
    const req: Record<string, unknown> = {
      headers: headerValue ? { [CORRELATION_ID_HEADER]: headerValue } : {},
    };
    const res = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();
    return { req, res, next };
  }

  // -----------------------------------------------------------------------

  it('should generate a UUID when no correlation-id header is present', () => {
    const { req, res, next } = createMocks();

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).toBeDefined();
    // UUID v4 pattern
    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should use the existing header value when x-correlation-id is present', () => {
    const { req, res, next } = createMocks('existing-id-123');

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).toBe('existing-id-123');
  });

  it('should set the correlation-id response header', () => {
    const { req, res, next } = createMocks('my-trace-id');

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      'my-trace-id',
    );
  });

  it('should set the response header with a generated ID when no header is sent', () => {
    const { req, res, next } = createMocks();

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      req.correlationId,
    );
  });

  it('should call next()', () => {
    const { req, res, next } = createMocks();

    middleware.use(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
