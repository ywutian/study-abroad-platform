/**
 * AI 系统错误类层级
 *
 * 提供可抛出的错误类（替代 throw new Error('...')），
 * 包含 retryable 属性以让 ResilienceService 自动决定是否重试。
 */

import { AgentErrorCode } from '../types';

// ── Base ──────────────────────────────────────────────────────

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AgentErrorCode | string,
    public readonly retryable: boolean,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// ── LLM Provider errors ──────────────────────────────────────

export class LLMProviderError extends AIError {
  constructor(
    message: string,
    public readonly httpStatus?: number,
    details?: Record<string, unknown>,
  ) {
    const { code, retryable } = LLMProviderError.classify(httpStatus);
    super(message, code, retryable, details);
    this.name = 'LLMProviderError';
  }

  private static classify(status?: number): {
    code: AgentErrorCode;
    retryable: boolean;
  } {
    switch (status) {
      case 401:
      case 403:
        return {
          code: AgentErrorCode.INTERNAL_ERROR,
          retryable: false,
        };
      case 429:
        return { code: AgentErrorCode.LLM_RATE_LIMIT, retryable: true };
      case 400:
        return {
          code: AgentErrorCode.LLM_INVALID_RESPONSE,
          retryable: false,
        };
      case 500:
      case 502:
      case 503:
        return {
          code: AgentErrorCode.SERVICE_UNAVAILABLE,
          retryable: true,
        };
      default:
        return { code: AgentErrorCode.INTERNAL_ERROR, retryable: false };
    }
  }
}

// ── Tool execution errors ────────────────────────────────────

export class ToolExecutionError extends AIError {
  constructor(
    message: string,
    public readonly toolName: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) {
    super(message, AgentErrorCode.TOOL_EXECUTION_FAILED, retryable, details);
    this.name = 'ToolExecutionError';
  }
}

// ── JSON parse errors ────────────────────────────────────────

export class JSONParseError extends AIError {
  constructor(
    message: string,
    public readonly rawContent: string,
  ) {
    super(message, AgentErrorCode.LLM_INVALID_RESPONSE, true, {
      rawContentLength: rawContent.length,
    });
    this.name = 'JSONParseError';
  }
}

// ── Context length exceeded ──────────────────────────────────

export class ContextLengthError extends AIError {
  constructor(
    message: string,
    public readonly tokenCount?: number,
    public readonly maxTokens?: number,
  ) {
    super(message, AgentErrorCode.LLM_INVALID_RESPONSE, false, {
      tokenCount,
      maxTokens,
    });
    this.name = 'ContextLengthError';
  }
}

// ── Type guard ───────────────────────────────────────────────

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

export function isRetryable(error: unknown): boolean {
  if (isAIError(error)) return error.retryable;
  return false;
}
