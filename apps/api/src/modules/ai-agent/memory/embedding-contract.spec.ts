import {
  embeddingCacheKey,
  isEmbeddingVector,
  parseEmbeddingResponse,
  requestEmbeddings,
} from './embedding-contract';
import { ResilienceService } from '../core/resilience.service';
import { RedisService } from '../../../common/redis/redis.service';

const vector = () => Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
const payload = () => ({
  model: 'test-model',
  data: [{ index: 0, embedding: vector() }],
});

describe('Embedding contract', () => {
  it.each([401, 403, 400])(
    'does not retry HTTP %i through the existing resilience layer',
    async (status) => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockImplementation(
          async () => new Response('private body', { status }),
        );
      const resilience = new ResilienceService({
        connected: false,
      } as RedisService);
      await expect(
        resilience.withRetry(
          () =>
            requestEmbeddings(
              'https://provider/v1',
              'key',
              'm',
              ['synthetic'],
              100,
            ),
          { maxAttempts: 3, baseDelayMs: 0 },
        ),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(
    [
      [],
      [1],
      Array(1536).fill(0),
      [NaN, ...vector().slice(1)],
      [Infinity, ...vector().slice(1)],
      ['1', ...vector().slice(1)],
      Array(1536).fill(Number.MAX_VALUE),
      Array(1536).fill(1e40),
      Array(1536).fill(1e-100),
      new Array(1536),
    ].map((value) => [value]),
  )('rejects invalid vectors %#', (value) => {
    expect(isEmbeddingVector(value)).toBe(false);
  });
  it('accepts finite nonzero 1536 dimensional vectors', () =>
    expect(isEmbeddingVector(vector())).toBe(true));
  it('orders complete batches by index', () => {
    const second = vector().map((n) => -n);
    expect(
      parseEmbeddingResponse(
        {
          model: 'test-model',
          data: [{ index: 1, embedding: second }, payload().data[0]],
        },
        'test-model',
        2,
      ),
    ).toEqual([vector(), second]);
  });
  it.each([
    null,
    {},
    { ...payload(), model: 'other' },
    { ...payload(), data: [] },
    { ...payload(), data: [{ index: -1, embedding: vector() }] },
    { ...payload(), data: [{ index: 0.5, embedding: vector() }] },
    { ...payload(), data: [{ index: 1, embedding: vector() }] },
    { ...payload(), data: [{ index: 0, embedding: [] }] },
  ])('rejects malformed responses %#', (value) => {
    expect(() => parseEmbeddingResponse(value, 'test-model', 1)).toThrow(
      'embedding_invalid_response',
    );
  });
  it('rejects duplicate batch indices', () =>
    expect(() =>
      parseEmbeddingResponse(
        { ...payload(), data: [payload().data[0], payload().data[0]] },
        'test-model',
        2,
      ),
    ).toThrow());
  it('isolates provider/model and keys the actual truncated input', () => {
    const key = embeddingCacheKey('https://provider/v1', 'm', 'private');
    expect(key).not.toContain('private');
    expect(key).not.toEqual(
      embeddingCacheKey('https://other/v1', 'm', 'private'),
    );
    expect(key).not.toEqual(
      embeddingCacheKey('https://provider/v1', 'other', 'private'),
    );
    expect(
      embeddingCacheKey('https://provider/v1/', 'm', 'x'.repeat(8000) + 'a'),
    ).toEqual(
      embeddingCacheKey('https://provider/v1', 'm', 'x'.repeat(8000) + 'b'),
    );
  });
  it('requests floats and forbids redirects', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(payload())));
    await expect(
      requestEmbeddings(
        'https://provider/v1/',
        'synthetic-key',
        'test-model',
        ['hello'],
        100,
      ),
    ).resolves.toEqual([vector()]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider/v1/embeddings',
      expect.objectContaining({
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
    const body = fetchMock.mock.calls[0][1]?.body;
    if (typeof body !== 'string') throw new Error('fixture_body_missing');
    expect(JSON.parse(body)).toMatchObject({
      encoding_format: 'float',
    });
  });
  it.each([401, 403, 400, 429, 500, 503])(
    'redacts HTTP %i and classifies retry',
    async (status) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('PRIVATE_UPSTREAM_BODY', { status }));
      await expect(
        requestEmbeddings('https://provider/v1', 'key', 'm', ['private'], 100),
      ).rejects.toMatchObject({
        message: `embedding_http_${status}`,
        retryable: [429, 500, 503].includes(status),
      });
    },
  );
  it('redacts network exceptions', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('PRIVATE_CREDENTIAL'));
    await expect(
      requestEmbeddings('https://provider/v1', 'key', 'm', ['private'], 100),
    ).rejects.toMatchObject({ message: 'embedding_transport_failed' });
  });
  it('does not retry invalid JSON', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('not json'));
    await expect(
      requestEmbeddings('https://provider/v1', 'key', 'm', ['private'], 100),
    ).rejects.toMatchObject({
      message: 'embedding_invalid_json',
      retryable: false,
    });
  });
  it.each(['fetch', 'body'])(
    'bounds stalled %s even if transport ignores abort',
    async (stage) => {
      jest.useFakeTimers();
      const stalled = new Promise<never>(() => undefined);
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        stage === 'fetch'
          ? stalled
          : Promise.resolve({
              ok: true,
              json: () => stalled,
            } as unknown as Response),
      );
      const result = expect(
        requestEmbeddings('https://provider/v1', 'key', 'm', ['private'], 100),
      ).rejects.toMatchObject({ message: 'embedding_timeout' });
      await jest.advanceTimersByTimeAsync(101);
      await result;
    },
  );
});
