/**
 * Provider-neutral LLM interface.
 *
 * Current implementation: OpenAIProvider (including compatible endpoints).
 */

import {
  LLMChatRequest,
  LLMChatResponse,
  LLMStreamChunk,
} from './llm-provider.types';

export interface ILLMProvider {
  readonly providerId: string;

  /** Non-streaming chat completion */
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;

  /** Streaming chat completion */
  chatStream(request: LLMChatRequest): AsyncGenerator<LLMStreamChunk>;

  /** Check if this provider supports the given model */
  supportsModel(model: string): boolean;

  /** Get the context window size for a model (if known) */
  getContextWindow(model: string): number | undefined;
}

/** NestJS injection tokens */
export const LLM_PROVIDER_TOKEN = Symbol('LLM_PROVIDER');
export const EMBEDDING_PROVIDER_TOKEN = Symbol('EMBEDDING_PROVIDER');
