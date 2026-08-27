import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';
import { EmbeddingService } from './embedding.service';

describe('Embedding cache and degradation', () => {
  const vector = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    withClient: jest.fn(
      async (
        _mode: string,
        _key: string,
        fn: (client: {
          set: (key: string, value: string) => Promise<void>;
        }) => unknown,
      ) =>
        fn({
          set: async (key, value) => {
            store.set(key, value);
          },
        }),
    ),
  };
  const make = (model = 'm', baseUrl = 'https://provider/v1') =>
    new EmbeddingService(
      redis as unknown as RedisService,
      new ConfigService({
        OPENAI_API_KEY: 'synthetic-key',
        OPENAI_BASE_URL: baseUrl,
        EMBEDDING_MODEL: model,
      }),
    );
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        if (typeof init?.body !== 'string')
          throw new Error('fixture_body_missing');
        const body = JSON.parse(init.body) as {
          model: string;
          input: string[];
        };
        return new Response(
          JSON.stringify({
            model: body.model,
            data: body.input.map((_, index) => ({ index, embedding: vector })),
          }),
        );
      });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('does not cache a late success after the real service deadline', async () => {
    jest.useFakeTimers();
    let resolveFetch!: (response: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const pending = make().embed('late');
    await jest.advanceTimersByTimeAsync(15001);
    expect(await pending).toEqual([]);
    resolveFetch(
      new Response(
        JSON.stringify({ model: 'm', data: [{ index: 0, embedding: vector }] }),
      ),
    );
    await jest.advanceTimersByTimeAsync(1);
    expect(store.size).toBe(0);
  });
  it('hits validated Redis cache with no second provider call', async () => {
    const service = make();
    expect(await service.embed('hello')).toEqual(vector);
    expect(await service.embed('hello')).toEqual(vector);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect([...store.keys()][0]).toMatch(/^emb:v2:[a-f0-9]{64}$/);
  });
  it('does not read legacy cache or other model/provider entries', async () => {
    await make().embed('hello');
    await make('other').embed('hello');
    await make('m', 'https://other/v1').embed('hello');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      redis.get.mock.calls.every(([key]) => key.startsWith('emb:v2:')),
    ).toBe(true);
  });
  it('refetches corrupt or wrong-dimension cached vectors', async () => {
    const service = make();
    await service.embed('hello');
    for (const key of store.keys()) store.set(key, '[1,2,3]');
    expect(await service.embed('hello')).toEqual(vector);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('validates complete batch before caching any result', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'm',
          data: [
            { index: 0, embedding: vector },
            { index: 0, embedding: vector },
          ],
        }),
      ),
    );
    expect(await make().embedBatch(['a', 'b'])).toEqual([[], []]);
    expect(store.size).toBe(0);
  });
  it('preserves cache hits on batch failure without leaking transport data', async () => {
    const service = make();
    await service.embed('cached');
    const log = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error('PRIVATE_UPSTREAM_TEXT'));
    expect(await service.embedBatch(['cached', 'uncached'])).toEqual([
      vector,
      [],
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      'PRIVATE_UPSTREAM_TEXT',
    );
  });
  it('continues with LRU when Redis reads and writes fail', async () => {
    const failingRedis = {
      get: jest.fn().mockRejectedValue(new Error('private')),
      withClient: jest.fn().mockRejectedValue(new Error('private')),
    };
    const service = new EmbeddingService(
      failingRedis as unknown as RedisService,
      new ConfigService({ OPENAI_API_KEY: 'synthetic', EMBEDDING_MODEL: 'm' }),
    );
    const first = await service.embed('hello');
    first[0] = 99;
    expect(await service.embed('hello')).toEqual(vector);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keys truncated input and skips whitespace', async () => {
    const service = make();
    await service.embed('x'.repeat(8000) + 'a');
    await service.embed('x'.repeat(8000) + 'b');
    expect(await service.embedBatch(['', '   '])).toEqual([[], []]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
