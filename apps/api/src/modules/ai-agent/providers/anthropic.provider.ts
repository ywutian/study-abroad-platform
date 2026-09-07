import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMProvider } from './llm-provider.interface';
import {
  LLMChatRequest,
  LLMChatResponse,
  LLMErrorCode,
  LLMProviderError,
  LLMStreamChunk,
} from './llm-provider.types';
import {
  buildNativeRequest,
  nativeError,
  parseNativeJson,
  parseNativeResponse,
} from './native-claude.contract';
import { NativeClaudeStream, parseNativeEvent } from './native-claude.stream';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

@Injectable()
export class AnthropicProvider implements ILLMProvider {
  readonly providerId = 'anthropic';

  constructor(private readonly config: ConfigService) {}

  supportsModel(model: string): boolean {
    return /^claude-[a-z0-9-]{1,80}$/.test(model);
  }

  getContextWindow(_model: string): number | undefined {
    // Do not infer limits for a relay alias or invent vendor capabilities.
    return undefined;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const body = buildNativeRequest(request, false);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeout(request.timeoutMs),
    );
    try {
      const response = await this.fetch(body, controller.signal);
      let text = '';
      for await (const chunk of this.read(response)) text += chunk;
      return parseNativeResponse(parseNativeJson(text), request);
    } catch (error) {
      throw this.safeError(error, controller.signal);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  async *chatStream(request: LLMChatRequest): AsyncGenerator<LLMStreamChunk> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeout(request.timeoutMs),
    );
    try {
      const response = await this.fetch(
        buildNativeRequest(request, true),
        controller.signal,
      );
      const state = new NativeClaudeStream(request);
      let buffer = '';
      for await (const text of this.read(response)) {
        buffer += text;
        let separator: RegExpExecArray | null;
        while ((separator = /\r?\n\r?\n/.exec(buffer))) {
          const frame = buffer.slice(0, separator.index);
          buffer = buffer.slice(separator.index + separator[0].length);
          const value = parseNativeEvent(frame);
          if (value !== undefined)
            for (const chunk of state.consume(value)) yield chunk;
          if (state.complete) return;
        }
      }
      // A complete final frame need not end with an extra blank line.
      if (buffer.trim()) {
        const value = parseNativeEvent(buffer);
        if (value !== undefined)
          for (const chunk of state.consume(value)) yield chunk;
      }
      if (!state.complete) throw nativeError();
    } catch (error) {
      yield {
        type: 'error',
        error: this.safeError(error, controller.signal).message,
      };
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  private timeout(requestTimeout?: number): number {
    const value = Number(this.config.get('AI_REQUEST_TIMEOUT_MS', 120000));
    const configured =
      Number.isSafeInteger(value) && value > 0 ? value : 120000;
    return requestTimeout &&
      Number.isSafeInteger(requestTimeout) &&
      requestTimeout > 0
      ? Math.min(configured, requestTimeout)
      : configured;
  }

  private async fetch(
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Response> {
    if (this.config.get('AI_AGENT_NATIVE_CLAUDE_V1') !== 'true')
      throw nativeError(LLMErrorCode.INVALID_REQUEST);
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey?.trim()) throw nativeError(LLMErrorCode.AUTHENTICATION);
    const base = this.config.get<string>(
      'ANTHROPIC_BASE_URL',
      'https://api.anthropic.com/v1',
    );
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      throw nativeError(LLMErrorCode.INVALID_REQUEST);
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw nativeError(LLMErrorCode.INVALID_REQUEST);
    url.pathname = url.pathname.replace(/\/$/, '');
    if (!url.pathname.endsWith('/v1')) url.pathname += '/v1';
    url.pathname += '/messages';
    const response = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      const status = response.status;
      const code =
        status === 401
          ? LLMErrorCode.AUTHENTICATION
          : status === 403
            ? LLMErrorCode.PERMISSION_DENIED
            : status === 429
              ? LLMErrorCode.RATE_LIMIT
              : status >= 500
                ? LLMErrorCode.SERVER_ERROR
                : LLMErrorCode.INVALID_REQUEST;
      throw new LLMProviderError(
        `Native Claude HTTP ${status}`,
        code,
        status === 429 || status >= 500,
        status,
      );
    }
    return response;
  }

  private async *read(response: Response): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw nativeError();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw nativeError();
        yield decoder.decode(chunk.value, { stream: true });
      }
      const tail = decoder.decode();
      if (tail) yield tail;
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  private safeError(error: unknown, signal: AbortSignal): LLMProviderError {
    if (error instanceof LLMProviderError) return error;
    return new LLMProviderError(
      signal.aborted
        ? 'Native Claude timeout'
        : 'Native Claude transport failed',
      LLMErrorCode.NETWORK_ERROR,
      true,
    );
  }
}
