import {
  CorrelationIdMiddleware,
  CORRELATION_ID_HEADER,
} from './correlation-id.middleware';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    expect(req.correlationId).toMatch(UUID_REGEX);
  });

  it('should use a valid UUID header value when provided', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { req, res, next } = createMocks(validUuid);

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).toBe(validUuid);
  });

  it('should reject non-UUID header values and generate a new UUID', () => {
    const { req, res, next } = createMocks('not-a-uuid');

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).not.toBe('not-a-uuid');
    expect(req.correlationId).toMatch(UUID_REGEX);
  });

  it('should reject oversized header values (log injection prevention)', () => {
    const oversizedValue = 'A'.repeat(10000);
    const { req, res, next } = createMocks(oversizedValue);

    middleware.use(req as any, res as any, next);

    expect(req.correlationId).not.toBe(oversizedValue);
    expect(req.correlationId).toMatch(UUID_REGEX);
  });

  it('should set the correlation-id response header with valid UUID', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { req, res, next } = createMocks(validUuid);

    middleware.use(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      validUuid,
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
