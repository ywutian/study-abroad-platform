import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { resolveOpenAIChatConfig } from './openai-chat.config';
import { validateEnv } from './env.validation';
import { OpenAIProvider } from '../../modules/ai-agent/providers/openai.provider';
import { runtimeModel } from '../../modules/ai-agent/providers/runtime-model';
import { EmbeddingService } from '../../modules/ai-agent/memory/embedding.service';
import { RedisService } from '../redis/redis.service';

const legacy = {
  OPENAI_API_KEY: 'synthetic-embedding',
  OPENAI_BASE_URL: 'https://embedding.example/v1',
  OPENAI_MODEL: 'gpt-4o-mini',
};
const dedicated = {
  OPENAI_CHAT_API_KEY: 'synthetic-chat',
  OPENAI_CHAT_BASE_URL: 'https://chat.example/v1/',
  OPENAI_CHAT_MODEL: 'gpt-5.4',
  OPENAI_CHAT_TRANSPORT: 'sse',
  OPENAI_CHAT_REASONING_EFFORT: 'none',
};
const config = (overrides: Record<string, unknown> = {}) =>
  new ConfigService({ ...legacy, ...overrides });
const resolve = (values: Record<string, string | undefined>) =>
  resolveOpenAIChatConfig((key) => values[key]);
function sse() {
  const frames = [
    {
      model: 'gpt-5.4',
      choices: [{ index: 0, delta: { content: 'OK' }, finish_reason: 'stop' }],
    },
    {
      choices: [],
      usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
    },
    '[DONE]',
  ];
  return new Response(
    frames
      .map((f) => `data: ${typeof f === 'string' ? f : JSON.stringify(f)}\n\n`)
      .join(''),
  );
}
describe('dedicated chat boundary', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
    jest.restoreAllMocks();
  });
  it('keeps the legacy default and resolves the dedicated runtime model', () => {
    expect(resolve(legacy)).toMatchObject({
      apiKey: legacy.OPENAI_API_KEY,
      baseUrl: legacy.OPENAI_BASE_URL,
      streamOnly: false,
    });
    expect(runtimeModel((key) => config(dedicated).get(key))).toBe('gpt-5.4');
    expect(
      runtimeModel((key) =>
        config({
          ...dedicated,
          LLM_PROVIDER: 'anthropic',
          ANTHROPIC_MODEL: 'claude-sonnet-5',
        }).get(key),
      ),
    ).toBe('claude-sonnet-5');
  });
  it.each(['OPENAI_CHAT_API_KEY', 'OPENAI_CHAT_BASE_URL', 'OPENAI_CHAT_MODEL'])(
    'rejects missing %s even if legacy fallback exists',
    (key) => {
      expect(() =>
        resolve({ ...legacy, ...dedicated, [key]: undefined }),
      ).toThrow('OPENAI_CHAT configuration');
      expect(() => resolve({ ...legacy, ...dedicated, [key]: ' ' })).toThrow(
        'OPENAI_CHAT configuration',
      );
    },
  );
  it.each([
    'http://chat.example/v1',
    'https://user:private@chat.example/v1',
    'https://chat.example/v1?key=private',
    'https://chat.example/v1#private',
    'invalid',
  ])('rejects unsafe URLs without disclosing values', (url) => {
    expect(() => resolve({ ...dedicated, OPENAI_CHAT_BASE_URL: url })).toThrow(
      'OPENAI_CHAT configuration is incomplete or invalid',
    );
  });
  it('validates the atomic settings at environment startup', () => {
    const env = {
      DATABASE_URL: 'postgresql://synthetic:synthetic@localhost:5432/test',
      JWT_SECRET: 'synthetic-secret-long-enough',
      JWT_REFRESH_SECRET: 'synthetic-refresh-long-enough',
      NODE_ENV: 'test',
      ...legacy,
    };
    expect(() =>
      validateEnv({
        ...env,
        OPENAI_CHAT_BASE_URL: dedicated.OPENAI_CHAT_BASE_URL,
      }),
    ).toThrow('OPENAI_CHAT configuration');
    expect(validateEnv({ ...env, ...dedicated }).OPENAI_CHAT_MODEL).toBe(
      'gpt-5.4',
    );
  });
  it('collects SSE for non-routed callers without sending the embedding key', async () => {
    const mock = jest.fn().mockResolvedValue(sse());
    global.fetch = mock;
    const result = await new OpenAIProvider(config(dedicated)).chat({
      model: 'gpt-5.4',
      systemPrompt: 'Synthetic',
      messages: [],
    });
    expect(result).toMatchObject({
      content: 'OK',
      model: 'gpt-5.4',
      usage: { totalTokens: 6 },
    });
    expect(String(mock.mock.calls[0][0])).toBe(
      'https://chat.example/v1/chat/completions',
    );
    const init = mock.mock.calls[0][1];
    expect(init.headers.Authorization).toBe('Bearer synthetic-chat');
    expect(JSON.parse(init.body)).toMatchObject({
      stream: true,
      reasoning_effort: 'none',
      stream_options: { include_usage: true },
    });
    expect(JSON.stringify(init)).not.toContain('synthetic-embedding');
  });
  it('leaves actual embedding HTTP requests on the old key, endpoint and model', async () => {
    const mock = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ embedding: [1, 0] }] })),
      );
    global.fetch = mock;
    const embedding = new EmbeddingService(
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      } as unknown as RedisService,
      config(dedicated),
    );
    expect(await embedding.embed('synthetic fixture')).toEqual([1, 0]);
    expect(mock.mock.calls[0][0]).toBe(
      'https://embedding.example/v1/embeddings',
    );
    expect(mock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer synthetic-embedding',
    );
    expect(JSON.parse(mock.mock.calls[0][1].body).model).toBe(
      'text-embedding-3-small',
    );
    expect(JSON.stringify(mock.mock.calls)).not.toContain('synthetic-chat');
  });
  it('does not leak upstream HTTP bodies or transport causes in errors/logs', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('PRIVATE_SYNTHETIC', { status: 401 }));
    const request = {
      model: 'gpt-4o-mini',
      systemPrompt: 'Synthetic',
      messages: [],
    };
    await expect(
      new OpenAIProvider(config()).chat(request),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION' });
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      'PRIVATE_SYNTHETIC',
    );
    global.fetch = jest.fn().mockRejectedValue(new Error('PRIVATE_SYNTHETIC'));
    const error = await new OpenAIProvider(config())
      .chat(request)
      .catch((e: Error) => e);
    expect(JSON.stringify(error)).not.toContain('PRIVATE_SYNTHETIC');
  });
});
