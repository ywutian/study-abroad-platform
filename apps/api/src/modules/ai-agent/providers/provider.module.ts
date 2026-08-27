/**
 * LLM Providers Module
 *
 * Dynamically injects the correct LLM provider based on env config.
 * Also provides global resilience (retry, circuit breaker) and token tracking.
 *
 * Default provider: OpenAI (also compatible with DeepSeek, Azure, etc.)
 */

import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER_TOKEN } from './llm-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { ModelRouterService } from '../routing/model-router.service';
import { ResilienceService } from '../core/resilience.service';
import { TokenTrackerService } from '../core/token-tracker.service';
import { LLMService } from '../core/llm.service';

@Module({})
export class LLMProvidersModule {
  static forRoot(): DynamicModule {
    return {
      module: LLMProvidersModule,
      global: true,
      providers: [
        OpenAIProvider,
        AnthropicProvider,
        {
          provide: LLM_PROVIDER_TOKEN,
          useFactory: (
            config: ConfigService,
            openai: OpenAIProvider,
            anthropic: AnthropicProvider,
          ) => {
            const provider = config.get<string>('LLM_PROVIDER', 'openai');
            if (provider === 'anthropic') {
              if (
                config.get('AI_AGENT_NATIVE_CLAUDE_V1') !== 'true' ||
                !config.get<string>('ANTHROPIC_API_KEY')?.trim() ||
                !/^claude-[a-z0-9-]{1,80}$/.test(
                  config.get('ANTHROPIC_MODEL', ''),
                )
              ) {
                throw new Error(
                  'LLM_PROVIDER=anthropic requires native Claude flag, credential, and explicit model',
                );
              }
              return anthropic;
            }
            if (provider !== 'openai') {
              throw new Error(`Unsupported LLM provider: ${provider}`);
            }
            return openai;
          },
          inject: [ConfigService, OpenAIProvider, AnthropicProvider],
        },
        ResilienceService,
        ModelRouterService,
        TokenTrackerService,
        LLMService,
      ],
      exports: [
        LLM_PROVIDER_TOKEN,
        OpenAIProvider,
        ResilienceService,
        TokenTrackerService,
        LLMService,
      ],
    };
  }
}
