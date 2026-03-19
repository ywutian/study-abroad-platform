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
        {
          provide: LLM_PROVIDER_TOKEN,
          useFactory: (config: ConfigService, openai: OpenAIProvider) => {
            const provider = config.get<string>('LLM_PROVIDER', 'openai');
            switch (provider) {
              case 'openai':
              default:
                return openai;
              // Future: case 'anthropic': return anthropic;
            }
          },
          inject: [ConfigService, OpenAIProvider],
        },
        ResilienceService,
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
