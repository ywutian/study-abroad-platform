import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearAuthData,
} from '../storage/secure-store';
import { addBreadcrumb } from '@/lib/sentry';
import type { ApiError } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4101';
const API_VERSION = '/api/v1';

/** HTTP status codes that are safe to retry on */
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  retries?: number;
  timeout?: number;
  skipAuth?: boolean;
}

function unwrapApiResponse<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as { data: T }).data;
  }

  return json as T;
}

/** Custom error that carries the HTTP status code for retry decisions */
class HttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Network failures
  if (error.message.includes('Network')) return true;
  // Timeout (AbortError is already re-thrown as a timeout message)
  if (error.message.startsWith('Request timeout')) return true;
  // Retryable HTTP status codes
  if (error instanceof HttpError && error.status && RETRYABLE_STATUS_CODES.has(error.status)) {
    return true;
  }
  return false;
}

type RefreshCallback = () => void;

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;
  private onRefreshFailed: RefreshCallback | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setOnRefreshFailed(callback: RefreshCallback): void {
    this.onRefreshFailed = callback;
  }

  private async refreshToken(): Promise<boolean> {
    // If a refresh is already in-flight, all callers share the same promise.
    // The promise clears itself in .finally(), so the next caller after
    // settlement will start a fresh refresh.
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}${API_VERSION}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await clearAuthData();
        this.onRefreshFailed?.();
        return false;
      }

      const json = await response.json();
      const data = unwrapApiResponse<{
        accessToken?: string;
        refreshToken?: string;
      }>(json);

      if (!data.accessToken) {
        await clearAuthData();
        this.onRefreshFailed?.();
        return false;
      }

      try {
        await saveTokens(data.accessToken, data.refreshToken);
      } catch (storageError) {
        console.error('Failed to persist refreshed tokens:', storageError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await clearAuthData();
      this.onRefreshFailed?.();
      return false;
    }
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, retries = 1, timeout = 15000, skipAuth = false, ...init } = config;
    const method = (init.method || 'GET').toUpperCase();

    // All endpoints use API version prefix
    let url = `${this.baseUrl}${API_VERSION}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const paramString = searchParams.toString();
      if (paramString) {
        url += `?${paramString}`;
      }
    }

    const makeRequest = async (isRetry = false): Promise<T> => {
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Client-Type': 'mobile',
        ...init.headers,
      };

      if (token && !skipAuth) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Handle 401 - try refresh
        if (response.status === 401 && !skipAuth && !isRetry) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            return makeRequest(true);
          }
          throw new Error('Session expired');
        }

        if (!response.ok) {
          const error: ApiError = await response.json().catch(() => ({
            message: `HTTP ${response.status}`,
          }));
          throw new HttpError(error.message || `HTTP ${response.status}`, response.status);
        }

        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        const json = JSON.parse(text);
        return unwrapApiResponse<T>(json);
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new HttpError(`Request timeout (${timeout / 1000}s)`);
        }

        throw error;
      }
    };

    // Retry logic
    for (let i = 0; i <= retries; i++) {
      try {
        return await makeRequest();
      } catch (error: unknown) {
        if (i < retries && isRetryableError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }

        // Record Sentry breadcrumb for failed API requests
        if (error instanceof Error) {
          addBreadcrumb({
            category: 'api',
            message: `${method} ${endpoint} failed: ${error.message}`,
            level: 'error',
            data: {
              url: endpoint,
              method,
              status: error instanceof HttpError ? error.status : undefined,
            },
          });
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // SSE stream support for AI chat
  private async openStream(
    endpoint: string,
    data?: unknown,
    signal?: AbortSignal,
    token?: string | null
  ): Promise<Response> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Client-Type': 'mobile',
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    return fetch(`${this.baseUrl}${API_VERSION}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal,
    });
  }

  async *stream(
    endpoint: string,
    data?: unknown,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    let token = await getAccessToken();
    let response = await this.openStream(endpoint, data, signal, token);

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        throw new Error('Session expired');
      }
      token = await getAccessToken();
      response = await this.openStream(endpoint, data, signal, token);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const CHUNK_TIMEOUT_MS = 60_000; // 60s per-chunk timeout

    try {
      while (true) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Stream chunk timeout')), CHUNK_TIMEOUT_MS)
        );
        const { done, value } = await Promise.race([readPromise, timeoutPromise]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.replace(/\r$/, '');
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              yield data;
            }
          }
        }
      }

      const trailingLine = buffer.replace(/\r$/, '').trim();
      if (trailingLine.startsWith('data: ')) {
        const data = trailingLine.slice(6);
        if (data !== '[DONE]') {
          yield data;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
