import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearAuthData,
} from '../storage/secure-store';
import type { ApiError } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const API_VERSION = '/api/v1';

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  retries?: number;
  timeout?: number;
  skipAuth?: boolean;
}

type RefreshCallback = () => void;

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private onRefreshFailed: RefreshCallback | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setOnRefreshFailed(callback: RefreshCallback): void {
    this.onRefreshFailed = callback;
  }

  private async refreshToken(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}${API_VERSION}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await clearAuthData();
        this.onRefreshFailed?.();
        return false;
      }

      const json = await response.json();
      // Unwrap backend standard response format
      const data = json.data !== undefined ? json.data : json;
      await saveTokens(data.accessToken, data.refreshToken);
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
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        const json = JSON.parse(text);
        // Unwrap backend standard response format: { success: true, data: {...} }
        return json.data !== undefined ? json.data : json;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout (${timeout / 1000}s)`);
        }

        throw error;
      }
    };

    // Retry logic
    for (let i = 0; i <= retries; i++) {
      try {
        return await makeRequest();
      } catch (error: unknown) {
        if (i < retries && error instanceof Error && error.message.includes('Network')) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
          continue;
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
  async *stream(endpoint: string, data?: unknown): AsyncGenerator<string, void, unknown> {
    const token = await getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${API_VERSION}${endpoint}`, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              yield data;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
