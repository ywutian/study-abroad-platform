import type { Message } from '../types';
import type {
  LLMChatRequest,
  LLMMessage,
  LLMToolDefinition,
} from '../providers/llm-provider.types';
import type { LLMOptions } from './llm.service';

/** Existing provider-neutral request projection, shared without changing defaults. */
export function buildLlmRequest(
  systemPrompt: string,
  messages: Message[],
  options: LLMOptions,
  model: string,
  defaultTimeoutMs: number,
): LLMChatRequest {
  const llmMessages: LLMMessage[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    toolCalls: msg.toolCalls?.map((tc) => ({
      id: tc.id || '',
      name: tc.name,
      arguments: tc.arguments || {},
    })),
    toolCallId: msg.toolCallId,
  }));
  const tools: LLMToolDefinition[] | undefined = options.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
  const mergedProviderOptions: Record<string, unknown> = {
    ...options.providerOptions,
  };
  if (options.seed !== undefined) mergedProviderOptions.seed = options.seed;
  return {
    systemPrompt,
    messages: llmMessages,
    model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
    tools,
    toolChoice: tools?.length ? 'auto' : undefined,
    ...(Object.keys(mergedProviderOptions).length > 0 && {
      providerOptions: mergedProviderOptions,
    }),
  };
}
