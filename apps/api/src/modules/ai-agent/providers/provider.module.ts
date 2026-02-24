/**
 * LLM Providers Module
 *
 * Dynamically injects the correct LLM provider based on env config.
 * Default: OpenAI (also compatible with DeepSeek, Azure, etc.)
 */

import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER_TOKEN } from './llm-provider.interface';
import { OpenAIProvider } from './openai.provider';

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
      ],
      exports: [LLM_PROVIDER_TOKEN, OpenAIProvider],
    };
  }
}
