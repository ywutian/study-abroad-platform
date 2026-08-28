import { fetchSemanticCapture } from './semantic-capture-http';

describe('bounded semantic capture HTTP', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each(['connect', 'body'])(
    'bounds a hanging %s even without abort support',
    async (stage) => {
      const never = new Promise<never>(() => {});
      const fetchImpl = jest
        .fn()
        .mockImplementation(() =>
          stage === 'connect' ? never : Promise.resolve({ text: () => never }),
        );
      const result = fetchSemanticCapture(
        'https://example.invalid',
        {},
        30,
        fetchImpl,
      );
      const assertion = expect(result).rejects.toThrow(
        'SEMANTIC_REQUEST_TIMEOUT',
      );
      await jest.advanceTimersByTimeAsync(31);
      await assertion;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('never surfaces raw network errors or follows redirects', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValue(new Error('secret-private-text'));
    await expect(
      fetchSemanticCapture('https://example.invalid', {}, 30, fetchImpl),
    ).rejects.toThrow('SEMANTIC_REQUEST_FAILED');
    expect(fetchImpl.mock.calls[0][1].redirect).toBe('error');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns the complete response and clears the deadline', async () => {
    const response = new Response('complete', { status: 201 });
    const fetchImpl = jest.fn().mockResolvedValue(response);
    await expect(
      fetchSemanticCapture('https://example.invalid', {}, 30, fetchImpl),
    ).resolves.toEqual({ response, text: 'complete' });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects late success after system suspension before timers fire', async () => {
    const fetchImpl = jest.fn().mockImplementation(async () => {
      jest.setSystemTime(Date.now() + 100);
      return new Response('late');
    });
    await expect(
      fetchSemanticCapture('https://example.invalid', {}, 30, fetchImpl),
    ).rejects.toThrow('SEMANTIC_REQUEST_TIMEOUT');
    expect(jest.getTimerCount()).toBe(0);
  });
});
