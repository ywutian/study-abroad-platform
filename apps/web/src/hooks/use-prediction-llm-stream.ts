'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth';
import { getApiLocale } from '@/lib/api/client';
import { toBcp47 } from '@/lib/i18n/locale-utils';
import { AI_TIMEOUTS } from '@/lib/constants';
import { env } from '@/lib/env';

type PredictionStreamEvent =
  | { type: 'start'; cached?: boolean; mode?: 'single' | 'portfolio' }
  | { type: 'delta'; text?: string }
  | { type: 'done'; text?: string; cached?: boolean }
  | { type: 'error'; error?: string };

const STREAM_API_URL = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

export function usePredictionLlmStream() {
  const { accessToken: token, refreshAccessToken } = useAuth();
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chunkTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearTimeout(chunkTimeoutRef.current);
    setIsStreaming(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const start = useCallback(
    async (path: string, body?: unknown) => {
      if (isStreaming) return false;
      const controller = new AbortController();
      abortRef.current = controller;
      setContent('');
      setError(null);
      setCached(false);
      setIsStreaming(true);

      // Match apiClient: send the UI locale so the backend's @CurrentLocale()
      // streams the LLM answer in the right language. Without these headers a
      // raw fetch falls through to Accept-Language → English on a zh UI.
      const locale = getApiLocale();

      const doRequest = async (authToken: string | null) =>
        fetch(`${STREAM_API_URL}/api/v1${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Locale': locale,
            'Accept-Language': toBcp47(locale),
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          credentials: 'include',
          signal: controller.signal,
          body: body ? JSON.stringify(body) : JSON.stringify({}),
        });

      try {
        let response = await doRequest(token);
        if (response.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            response = await doRequest(useAuthStore.getState().accessToken);
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No stream reader');

        const resetChunkTimeout = () => {
          clearTimeout(chunkTimeoutRef.current);
          chunkTimeoutRef.current = setTimeout(() => {
            controller.abort(new Error('STREAM_TIMEOUT'));
          }, AI_TIMEOUTS.SSE_CHUNK);
        };

        const decoder = new TextDecoder();
        let buffer = '';
        resetChunkTimeout();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          resetChunkTimeout();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') {
              await reader.cancel().catch(() => undefined);
              clearTimeout(chunkTimeoutRef.current);
              setIsStreaming(false);
              return true;
            }
            let event: PredictionStreamEvent | null = null;
            try {
              event = JSON.parse(data) as PredictionStreamEvent;
            } catch {
              continue;
            }
            if (event.type === 'start') {
              setCached(Boolean(event.cached));
            } else if (event.type === 'delta' && event.text) {
              setContent((prev) => prev + event.text);
            } else if (event.type === 'done') {
              if (event.text) setContent(event.text);
              setCached(Boolean(event.cached));
              await reader.cancel().catch(() => undefined);
              clearTimeout(chunkTimeoutRef.current);
              setIsStreaming(false);
              return true;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Stream failed');
            }
          }
        }

        clearTimeout(chunkTimeoutRef.current);
        setIsStreaming(false);
        return true;
      } catch (streamError) {
        const isAbort = (streamError as Error).name === 'AbortError';
        if (!isAbort) {
          setError(streamError instanceof Error ? streamError.message : 'Stream failed');
        }
        clearTimeout(chunkTimeoutRef.current);
        setIsStreaming(false);
        return false;
      }
    },
    [isStreaming, refreshAccessToken, token]
  );

  return { content, isStreaming, error, cached, start, cancel };
}
