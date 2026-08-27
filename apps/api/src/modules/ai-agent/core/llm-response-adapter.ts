import type {
  LLMChatResponse,
  LLMStreamChunk,
} from '../providers/llm-provider.types';
import type { LLMResponse, StreamChunk } from './llm.service';

export function toInternalResponse(response: LLMChatResponse): LLMResponse {
  return {
    content: response.content,
    toolCalls: response.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
    finishReason:
      response.finishReason === 'tool_calls'
        ? 'tool_calls'
        : response.finishReason === 'length'
          ? 'length'
          : 'stop',
  };
}

export function adaptStreamChunk(chunk: LLMStreamChunk): StreamChunk {
  switch (chunk.type) {
    case 'content':
      return { type: 'content', content: chunk.content };
    case 'tool_call_end':
      return {
        type: 'tool_call',
        toolCall: chunk.toolCall
          ? {
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments,
            }
          : undefined,
      };
    case 'done':
      return { type: 'done' };
    case 'error':
      return { type: 'error', error: chunk.error };
    default:
      return { type: 'content' };
  }
}
