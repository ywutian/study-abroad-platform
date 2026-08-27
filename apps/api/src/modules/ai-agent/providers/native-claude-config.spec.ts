import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigValidatorService } from '../config/config-validator.service';
import { LLMService } from '../core/llm.service';
import { AgentType } from '../types';
import { AnthropicProvider } from './anthropic.provider';
import { ILLMProvider, LLM_PROVIDER_TOKEN } from './llm-provider.interface';
import { LLMProvidersModule } from './provider.module';
import { OpenAIProvider } from './openai.provider';
import { configuredRuntimeModel, runtimeModel } from './runtime-model';

function configuration(values: Record<string, unknown>) {
  return {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as ConfigService;
}

describe('Native Claude opt-in and shared runtime model', () => {
  const native = {
    LLM_PROVIDER: 'anthropic',
    AI_AGENT_NATIVE_CLAUDE_V1: 'true',
    ANTHROPIC_MODEL: 'claude-sonnet-5',
    ANTHROPIC_API_KEY: 'synthetic',
    OPENAI_MODEL: 'gpt-4o-mini',
  };
  function choose(values: Record<string, unknown>) {
    const config = configuration(values);
    const factory = LLMProvidersModule.forRoot().providers!.find(
      (entry) =>
        typeof entry === 'object' &&
        'provide' in entry &&
        entry.provide === LLM_PROVIDER_TOKEN,
    ) as FactoryProvider<ILLMProvider>;
    return factory.useFactory(
      config,
      new OpenAIProvider(config),
      new AnthropicProvider(config),
    ) as ILLMProvider;
  }

  it('retains the default OpenAI provider even when native credentials exist', () => {
    expect(choose({ ANTHROPIC_API_KEY: 'synthetic' }).providerId).toBe(
      'openai',
    );
    expect(choose({ ...native, LLM_PROVIDER: 'openai' }).providerId).toBe(
      'openai',
    );
  });
  it('selects native only with explicit provider, flag, credential, and model', () => {
    expect(choose(native).providerId).toBe('anthropic');
  });
  it.each([
    'AI_AGENT_NATIVE_CLAUDE_V1',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL',
  ])('rejects incomplete opt-in %s', (key) => {
    expect(() => choose({ ...native, [key]: '' })).toThrow(
      'requires native Claude',
    );
  });
  it('does not accept arbitrary provider identifiers', () => {
    expect(() => choose({ LLM_PROVIDER: 'unknown' })).toThrow(
      'Unsupported LLM provider',
    );
  });
  it('does not fall back to an OpenAI model when native model is missing', () => {
    const values: Record<string, string> = {
      LLM_PROVIDER: 'anthropic',
      OPENAI_MODEL: 'gpt-4o-mini',
    };
    expect(() => runtimeModel((key) => values[key])).toThrow(
      'ANTHROPIC_MODEL is required',
    );
  });
  it('retains legacy unset and configured model behavior', () => {
    expect(configuredRuntimeModel(() => undefined)).toBeUndefined();
    expect(runtimeModel(() => undefined)).toBe('gpt-5.4-mini');
    expect(
      runtimeModel((key) => (key === 'OPENAI_MODEL' ? ' gpt-5.5 ' : undefined)),
    ).toBe('gpt-5.5');
  });
  it.each(Object.values(AgentType))(
    'uses the same configured native model for Agent %s and reflection',
    (agentType) => {
      const validator = new ConfigValidatorService(configuration(native));
      const config = validator.getValidatedConfig(agentType);
      if (!config) throw new Error('Missing agent test fixture');
      expect(config.model).toBe('claude-sonnet-5');
      if (config.reflectionModel)
        expect(config.reflectionModel).toBe('claude-sonnet-5');
    },
  );
  it('passes an ordinary business call through LLMService and the native adapter', async () => {
    const original = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-5',
          content: [{ type: 'text', text: 'SYNTHETIC_OK' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 2, output_tokens: 3 },
        }),
      ),
    );
    global.fetch = fetchMock as typeof fetch;
    try {
      const config = configuration(native);
      const service = new LLMService(config, new AnthropicProvider(config));
      await expect(
        service.chatSimple([{ role: 'user', content: 'Synthetic' }]),
      ).resolves.toBe('SYNTHETIC_OK');
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: 'claude-sonnet-5',
        stream: false,
      });
    } finally {
      global.fetch = original;
    }
  });
});
