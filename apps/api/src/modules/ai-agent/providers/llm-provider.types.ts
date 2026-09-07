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
  /**
   * HTTP 403. The credential was accepted and then refused the operation —
   * exhausted quota, a missing model entitlement, or endpoint policy. It is
   * NOT a credential problem, and reporting it as one has now sent three
   * separate investigations at the wrong target: a relay whose balance ran
   * out answered 403 `insufficient_user_quota`, the logs said
   * "Authentication failed: 403", and #632 rotated the endpoint over it.
   */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RATE_LIMIT = 'RATE_LIMIT',
  CONTEXT_LENGTH = 'CONTEXT_LENGTH',
  CONTENT_FILTER = 'CONTENT_FILTER',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MODEL_MISMATCH = 'MODEL_MISMATCH',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
}

/**
 * Upstream error slugs worth naming in a log line. Matched against an error
 * body only to select one of these fixed strings — the body itself is never
 * retained, so no prompt, tool argument, response content or credential can
 * escape through here.
 *
 * They exist because the HTTP status alone lies about the cause twice over:
 * a drained gateway answers 403 (read as "bad credential" three times over
 * eleven days), and OpenAI answers 429 for an unfunded account (read as
 * "rate limited"). In both cases the account balance was the answer and the
 * word never reached the log.
 */
export const UPSTREAM_ERROR_SLUGS = [
  'insufficient_user_quota',
  'insufficient_quota',
  'insufficient_balance',
  'billing_hard_limit_reached',
  'exceeded_current_quota',
  'rate_limit_exceeded',
  'model_not_found',
  'invalid_api_key',
] as const;

/** Returns the first known slug present in `body`, or undefined. */
export function upstreamErrorSlug(body: string): string | undefined {
  return UPSTREAM_ERROR_SLUGS.find((slug) => body.includes(slug));
}

/** Content-free transport evidence. Never attach a request, response or Error. */
export interface LLMStreamFailure {
  phase: 'connect' | 'read' | 'protocol';
  reason: 'deadline' | 'transport' | 'http' | 'protocol';
  elapsedMs: number;
  receivedBytes: number;
  emittedBytes: number;
  firstByteMs: number | null;
  retryAfterRequested?: boolean;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly retryable: boolean,
    public readonly httpStatus?: number,
    public readonly details?: Record<string, unknown>,
    public readonly streamFailure?: LLMStreamFailure,
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}
