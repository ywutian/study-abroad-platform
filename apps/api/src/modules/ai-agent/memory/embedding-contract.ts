import { createHash } from 'crypto';
import {
  LLMErrorCode,
  upstreamErrorSlug,
  LLMProviderError,
} from '../providers/llm-provider.types';

/** Bounded allowlist peek; returns a fixed slug or nothing, never body text. */
async function readSlug(response: Response): Promise<string | undefined> {
  // A hostile or half-dead peer can make read() never settle, and this runs
  // on the error path — it must never be what keeps a failed call hanging.
  // Racing a short timer keeps the peek strictly best-effort.
  return Promise.race([
    readSlugInner(response),
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), 250),
    ),
  ]);
}

async function readSlugInner(response: Response): Promise<string | undefined> {
  try {
    const reader = response.body?.getReader();
    if (!reader) return undefined;
    const parts: string[] = [];
    const decoder = new TextDecoder('utf-8');
    let read = 0;
    while (read < 2048) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      read += value.length;
      parts.push(decoder.decode(value, { stream: true }));
    }
    void reader.cancel().catch(() => undefined);
    return upstreamErrorSlug(parts.join(''));
  } catch {
    return undefined;
  }
}
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_INPUT_LIMIT = 8000;

export function isEmbeddingVector(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS)
    return false;
  let norm = 0;
  for (const item of value as unknown[]) {
    if (
      typeof item !== 'number' ||
      !Number.isFinite(item) ||
      !Number.isFinite(Math.fround(item))
    )
      return false;
    norm += Math.fround(item) ** 2;
  }
  return Number.isFinite(norm) && norm > 0;
}

export function parseEmbeddingResponse(
  value: unknown,
  model: string,
  count: number,
): number[][] {
  const invalid = () =>
    new LLMProviderError(
      'embedding_invalid_response',
      LLMErrorCode.INVALID_RESPONSE,
      false,
    );
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid();
  const response = value as Record<string, unknown>;
  if (
    response.model !== model ||
    !Array.isArray(response.data) ||
    response.data.length !== count
  ) {
    throw invalid();
  }
  const ordered: number[][] = new Array(count);
  const seen = new Set<number>();
  for (const row of response.data) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw invalid();
    const { index, embedding } = row as Record<string, unknown>;
    if (
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= count ||
      seen.has(index) ||
      !isEmbeddingVector(embedding)
    ) {
      throw invalid();
    }
    seen.add(index);
    ordered[index] = embedding;
  }
  return ordered;
}

export function embeddingCacheKey(
  baseUrl: string,
  model: string,
  text: string,
): string {
  return `v2:${createHash('sha256')
    .update(
      JSON.stringify([
        baseUrl.replace(/\/+$/, ''),
        model,
        EMBEDDING_DIMENSIONS,
        text.slice(0, EMBEDDING_INPUT_LIMIT),
      ]),
    )
    .digest('hex')}`;
}

/** Own the deadline even when the optional resilience provider is unavailable. */
export async function requestEmbeddings(
  baseUrl: string,
  apiKey: string,
  model: string,
  inputs: string[],
  timeoutMs: number,
): Promise<number[][]> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new LLMProviderError(
          'embedding_timeout',
          LLMErrorCode.NETWORK_ERROR,
          true,
        ),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      deadline,
      (async () => {
        const response = await fetch(
          `${baseUrl.replace(/\/+$/, '')}/embeddings`,
          {
            method: 'POST',
            redirect: 'error',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              input: inputs,
              encoding_format: 'float',
            }),
          },
        );
        if (!response.ok) {
          // Same bounded allowlist peek as the routed chat path: an unfunded
          // OpenAI account answers 429 here too, and "embedding_http_429" on
          // its own cannot tell that apart from real throttling.
          const slug = await readSlug(response);
          const retryable = [429, 500, 502, 503, 504].includes(response.status);
          const code =
            response.status === 401
              ? LLMErrorCode.AUTHENTICATION
              : response.status === 403
                ? LLMErrorCode.PERMISSION_DENIED
                : response.status === 429
                  ? LLMErrorCode.RATE_LIMIT
                  : response.status >= 500
                    ? LLMErrorCode.SERVER_ERROR
                    : LLMErrorCode.INVALID_REQUEST;
          throw new LLMProviderError(
            slug
              ? `embedding_http_${response.status}_${slug}`
              : `embedding_http_${response.status}`,
            code,
            retryable,
            response.status,
          );
        }
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new LLMProviderError(
            'embedding_invalid_json',
            LLMErrorCode.INVALID_RESPONSE,
            false,
          );
        }
        return parseEmbeddingResponse(payload, model, inputs.length);
      })(),
    ]);
  } catch (error) {
    if (error instanceof LLMProviderError) throw error;
    // Never propagate transport messages: they can contain credentials or request data.
    throw new LLMProviderError(
      'embedding_transport_failed',
      LLMErrorCode.NETWORK_ERROR,
      true,
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
