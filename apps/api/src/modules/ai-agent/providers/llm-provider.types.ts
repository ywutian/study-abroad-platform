/**
 * Provider-neutral LLM types.
 *
 * These types keep LLMService and higher layers independent from the concrete
 * OpenAI-compatible transport implementation.
 */

// ── Messages ─────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  /** Parsed object, not stringified JSON */
  arguments: Record<string, unknown>;
}

// ── Tool definitions ─────────────────────────────────────────

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// ── Request / Response ───────────────────────────────────────

export interface LLMChatRequest {
  /** System prompt kept separate from conversation messages. */
  systemPrompt: string;
  messages: LLMMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Transport deadline; bounded by the provider's server-side timeout. */
  timeoutMs?: number;
  /** Strict opt-in task routing contract; legacy transport remains unchanged. */
  routed?: boolean;
  /** Set by the trusted task policy, not arbitrary providerOptions. */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  /** Provider-specific options (JSON mode, thinking, etc.) */
  providerOptions?: Record<string, unknown>;
}

export interface LLMChatResponse {
  model?: string;
  content: string;
  toolCalls?: LLMToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage?: LLMTokenUsage;
}

// ── Streaming ────────────────────────────────────────────────

export interface LLMStreamChunk {
  model?: string;
  finishReason?: LLMChatResponse['finishReason'];
  type:
    | 'content'
    | 'tool_call_start'
    | 'tool_call_delta'
    | 'tool_call_end'
    | 'done'
    | 'error';
  content?: string;
  toolCall?: Partial<LLMToolCall>;
  usage?: LLMTokenUsage;
  error?: string;
}

// ── Token usage ──────────────────────────────────────────────

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Optional provider-side prompt cache read tokens. */
  cacheReadTokens?: number;
}

// ── Errors ───────────────────────────────────────────────────

export enum LLMErrorCode {
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  CONTEXT_LENGTH = 'CONTEXT_LENGTH',
  CONTENT_FILTER = 'CONTENT_FILTER',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MODEL_MISMATCH = 'MODEL_MISMATCH',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly retryable: boolean,
    public readonly httpStatus?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}
