import {
  APPLICATION_ANALYSIS_DEGRADED_CACHE_TTL_SECONDS,
  PORTFOLIO_SYNTHESIZER_TIMEOUT_MS,
  ProfileApplicationAnalysisV2Service,
  SCHOOL_ANALYST_CONCURRENCY,
  SCHOOL_ANALYST_TIMEOUT_MS,
  shouldSkipPortfolioSynthesis,
} from './profile-application-analysis-v2.service';

describe('application analysis provider-outage resilience', () => {
  it('keeps the bounded five-school outage path within one short timeout wave', () => {
    expect(SCHOOL_ANALYST_CONCURRENCY).toBe(5);
    expect(SCHOOL_ANALYST_TIMEOUT_MS).toBeLessThanOrEqual(12_000);
    expect(PORTFOLIO_SYNTHESIZER_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });

  it('skips portfolio synthesis when every school LLM call failed', () => {
    expect(
      shouldSkipPortfolioSynthesis({
        mode: 'live',
        llmCallsAttempted: 5,
        llmCallsFailed: 5,
      }),
    ).toBe(true);
  });

  it.each([
    ['partial success', 'live', 5, 4],
    ['no school calls', 'live', 0, 0],
    ['deterministic replay', 'deterministic', 5, 5],
  ] as const)('does not skip for %s', (_name, mode, attempted, failed) => {
    expect(
      shouldSkipPortfolioSynthesis({
        mode,
        llmCallsAttempted: attempted,
        llmCallsFailed: failed,
      }),
    ).toBe(false);
  });

  function createService() {
    const redis = {
      getJSON: jest.fn().mockResolvedValue(null),
      setJSON: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProfileApplicationAnalysisV2Service(
      {} as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest
      .spyOn(service as any, 'buildCacheKey')
      .mockResolvedValue('analysis:user-1:en');
    jest
      .spyOn(service as any, 'buildSnapshotForUser')
      .mockResolvedValue({ locale: 'en' });
    return { service, redis };
  }

  it('single-flights concurrent cache misses for the same snapshot key', async () => {
    const { service } = createService();
    let resolveGeneration!: (value: any) => void;
    const generated = new Promise((resolve) => {
      resolveGeneration = resolve;
    });
    const generate = jest
      .spyOn(service as any, 'generateFromSnapshot')
      .mockReturnValue(generated);

    const first = service.getAnalysisForUser('user-1', 'en');
    await new Promise((resolve) => setImmediate(resolve));
    const second = service.getAnalysisForUser('user-1', 'en');
    await new Promise((resolve) => setImmediate(resolve));

    expect(generate).toHaveBeenCalledTimes(1);
    resolveGeneration({
      status: 'fresh',
      meta: { degradedReason: undefined },
    });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('briefly caches llmUnavailable degradation to prevent retry storms', async () => {
    const { service, redis } = createService();
    const degraded = {
      status: 'degraded',
      meta: { degradedReason: 'llmUnavailable' },
    };
    jest
      .spyOn(service as any, 'generateFromSnapshot')
      .mockResolvedValue(degraded);

    await service.getAnalysisForUser('user-1', 'en');

    expect(redis.setJSON).toHaveBeenCalledWith(
      'analysis:user-1:en',
      degraded,
      APPLICATION_ANALYSIS_DEGRADED_CACHE_TTL_SECONDS,
    );
  });

  it('does not cache a structural degradation that user data can immediately fix', async () => {
    const { service, redis } = createService();
    jest.spyOn(service as any, 'generateFromSnapshot').mockResolvedValue({
      status: 'degraded',
      meta: { degradedReason: 'schoolAnalysisFailed' },
    });

    await service.getAnalysisForUser('user-1', 'en');

    expect(redis.setJSON).not.toHaveBeenCalled();
  });
});
