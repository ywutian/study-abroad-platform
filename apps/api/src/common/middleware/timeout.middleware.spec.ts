import { TimeoutMiddleware } from './timeout.middleware';

describe('TimeoutMiddleware', () => {
  let middleware: TimeoutMiddleware;

  beforeEach(() => {
    jest.useFakeTimers();
    // Reset env vars before each test
    delete process.env.REQUEST_TIMEOUT_MS;
    delete process.env.AUTH_REQUEST_TIMEOUT_MS;
    delete process.env.AI_REQUEST_TIMEOUT_MS;
    middleware = new TimeoutMiddleware();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.REQUEST_TIMEOUT_MS;
    delete process.env.AUTH_REQUEST_TIMEOUT_MS;
    delete process.env.AI_REQUEST_TIMEOUT_MS;
  });

  function createMocks(path: string, method = 'GET') {
    const req = {
      path,
      method,
      url: path,
      originalUrl: path,
    } as any;

    const res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      on: jest.fn(),
    } as any;

    const next = jest.fn();

    return { req, res, next };
  }

  // -----------------------------------------------------------------------
  // Calls next()
  // -----------------------------------------------------------------------
  it('should call next()', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Registers response event listeners
  // -----------------------------------------------------------------------
  it('should register finish and close event listeners on the response', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  // -----------------------------------------------------------------------
  // Default timeout (30s) for regular endpoints
  // -----------------------------------------------------------------------
  it('should respond with 408 after default 30s timeout for regular endpoints', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);

    expect(res.status).toHaveBeenCalledWith(408);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'REQUEST_TIMEOUT',
          message: 'The request timed out. Please try again.',
          path: '/api/users',
        }),
      }),
    );
  });

  it('should not respond with 408 before the timeout elapses', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(29_999);

    expect(res.status).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Cloud Scheduler-driven cron runs are exempt (no 408 timer at all)
  // -----------------------------------------------------------------------
  it('should never 408 a /internal/cron run — the request IS the job (CPU stops when the response ends)', () => {
    const { req, res, next } = createMocks(
      '/api/v1/internal/cron/account-purge-service-handle-cron/run',
      'POST',
    );
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30 * 60_000);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does NOT exempt a request that merely mentions /internal/cron/ in its query string', () => {
    const { req, res, next } = createMocks('/api/v1/schools?x=/internal/cron/');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  // -----------------------------------------------------------------------
  // AI endpoint timeout (120s)
  // -----------------------------------------------------------------------
  it('should use AI timeout (120s) for /ai-agent/ endpoints', () => {
    const { req, res, next } = createMocks('/api/ai-agent/chat');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled();

    jest.advanceTimersByTime(90_000); // total 120s
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should use AI timeout for /ai/ endpoints', () => {
    const { req, res, next } = createMocks('/api/ai/generate');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(119_999);
    expect(res.status).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should use AI timeout for /prediction endpoints', () => {
    const { req, res, next } = createMocks('/api/prediction');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(120_000);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should use AI timeout for /recommendation endpoints', () => {
    const { req, res, next } = createMocks('/api/recommendation');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(120_000);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  // Regression: the application-analysis endpoint fans out N sequential
  // LLM calls (one per target school + portfolio synthesis) and routinely
  // exceeds the 30s default. It must inherit the 120s AI timeout even though
  // its path lives under /profiles/, not /ai/. See #393/#395 verify run.
  it('should use AI timeout for /profiles/me/ai-analysis', () => {
    const { req, res, next } = createMocks('/api/v1/profiles/me/ai-analysis');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled(); // would have 408'd on the default

    jest.advanceTimersByTime(90_000); // total 120s
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should use AI timeout for resume AI review endpoints containing /ai/', () => {
    const { req, res, next } = createMocks(
      '/api/v1/resumes/abc123/ai/review',
      'POST',
    );
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled();

    jest.advanceTimersByTime(90_000); // total 120s
    expect(res.status).toHaveBeenCalledWith(408);
  });

  // ---------------------------------------------------------------------
  // SSOT coverage: EVERY @ThrottleAI route that makes a synchronous LLM call
  // on the request path must inherit the 120s AI budget. The matcher (middleware)
  // can't read @ThrottleAI metadata at runtime, so this table is the guardrail —
  // it fails if a path segment is dropped from AI_ENDPOINT_URL_SEGMENTS. When you
  // add an LLM endpoint, add a row here and the segment to the SSOT array.
  // These are the routes the #393/#395 sibling-sweep adversarially verified.
  // ---------------------------------------------------------------------
  const AI_ROUTES: Array<[string, string]> = [
    ['/api/v1/profiles/me/ai-analysis', 'GET'],
    ['/api/v1/profiles/me/ai-analysis/feedback', 'POST'],
    ['/api/v1/essay-ai/polish', 'POST'],
    ['/api/v1/essay-ai/review', 'POST'],
    ['/api/v1/essay-ai/gallery/abc/analyze', 'POST'],
    ['/api/v1/essay-debate/turn', 'POST'],
    ['/api/v1/profiles/me/activities/ai-sort', 'POST'],
    ['/api/v1/profiles/me/activities/abc/refine', 'POST'],
    [
      '/api/v1/profiles/me/activities/abc/generate-common-app-description',
      'POST',
    ],
    ['/api/v1/halls/ranking-analysis', 'POST'],
    ['/api/v1/ai-agent/chat', 'POST'],
    ['/api/v1/resumes/abc/ai/review', 'POST'],
    ['/api/v1/predictions', 'POST'],
    ['/api/v1/recommendations', 'POST'],
  ];

  it.each(AI_ROUTES)('grants the 120s AI budget to %s (%s)', (path, method) => {
    const { req, res, next } = createMocks(path, method);
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled(); // would 408 on the 30s default

    jest.advanceTimersByTime(90_000); // total 120s
    expect(res.status).toHaveBeenCalledWith(408);
  });

  // Negative cases: non-LLM routes (even @ThrottleAI rate-limited ones with no
  // LLM call, and the fast sibling of an AI route) must keep the 30s default so
  // the matcher doesn't silently over-broaden into a blanket 120s.
  const NON_AI_ROUTES: Array<[string, string]> = [
    ['/api/v1/halls/ranking', 'POST'], // deterministic batch ranking, not ranking-analysis
    ['/api/v1/assessments/abc/submit', 'POST'], // @ThrottleAI rate-limit only, no LLM
    ['/api/v1/school-lists', 'POST'], // @ThrottleAI rate-limit only, no LLM
    ['/api/v1/profiles/me', 'PUT'],
    ['/api/v1/schools', 'GET'],
  ];

  it.each(NON_AI_ROUTES)(
    'keeps the 30s default for non-LLM route %s (%s)',
    (path, method) => {
      const { req, res, next } = createMocks(path, method);
      middleware.use(req, res, next);

      jest.advanceTimersByTime(30_000);
      expect(res.status).toHaveBeenCalledWith(408); // 408s at the 30s default
    },
  );

  // -----------------------------------------------------------------------
  // Auth endpoint timeout (60s)
  // -----------------------------------------------------------------------
  it('should use auth timeout (60s) for /auth/login endpoints', () => {
    const { req, res, next } = createMocks('/api/auth/login');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled();

    jest.advanceTimersByTime(30_000); // total 60s
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should use auth timeout (60s) for /auth/refresh endpoints', () => {
    const { req, res, next } = createMocks('/api/auth/refresh');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(60_000);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  // -----------------------------------------------------------------------
  // Custom env overrides
  // -----------------------------------------------------------------------
  it('should respect REQUEST_TIMEOUT_MS env var', () => {
    process.env.REQUEST_TIMEOUT_MS = '5000';
    middleware = new TimeoutMiddleware();
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(4_999);
    expect(res.status).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should respect AI_REQUEST_TIMEOUT_MS env var', () => {
    process.env.AI_REQUEST_TIMEOUT_MS = '10000';
    middleware = new TimeoutMiddleware();
    const { req, res, next } = createMocks('/api/ai/generate');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(10_000);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  it('should respect AUTH_REQUEST_TIMEOUT_MS env var', () => {
    process.env.AUTH_REQUEST_TIMEOUT_MS = '15000';
    middleware = new TimeoutMiddleware();
    const { req, res, next } = createMocks('/api/auth/login');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(15_000);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  // -----------------------------------------------------------------------
  // Headers already sent
  // -----------------------------------------------------------------------
  it('should not send 408 if headers are already sent', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    // Simulate response already sent
    res.headersSent = true;

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Clearing timeout on finish
  // -----------------------------------------------------------------------
  it('should clear timeout when response finishes', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    // Extract the 'finish' callback registered via res.on
    const finishCall = res.on.mock.calls.find(
      (call: [string, () => void]) => call[0] === 'finish',
    );
    const finishCallback = finishCall[1];

    // Simulate response finishing before timeout
    finishCallback();

    // Advance past timeout -- should NOT trigger 408
    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should clear timeout when connection closes', () => {
    const { req, res, next } = createMocks('/api/users');
    middleware.use(req, res, next);

    // Extract the 'close' callback
    const closeCall = res.on.mock.calls.find(
      (call: [string, () => void]) => call[0] === 'close',
    );
    const closeCallback = closeCall[1];

    closeCallback();

    jest.advanceTimersByTime(30_000);
    expect(res.status).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Response body format
  // -----------------------------------------------------------------------
  it('should include a valid ISO timestamp in the error response', () => {
    const { req, res, next } = createMocks('/api/data');
    middleware.use(req, res, next);

    jest.advanceTimersByTime(30_000);

    const jsonPayload = res.json.mock.calls[0][0];
    const timestamp = jsonPayload.error.timestamp;
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});
