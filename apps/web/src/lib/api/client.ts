import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_VERSION = '/api/v1';

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private apiVersion: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string, apiVersion: string = '') {
    this.baseUrl = baseUrl;
    this.apiVersion = apiVersion;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return useAuthStore.getState().accessToken;
  }

  private async refreshToken(): Promise<boolean> {
    // Prevent concurrent refresh calls
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = useAuthStore.getState().refreshAccessToken();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, retries = 1, timeout = 15000, signal, skipAuth = false, ...init } = config;

    // Auth endpoints don't need API version prefix
    const isAuthEndpoint = endpoint.startsWith('/auth');
    const versionPrefix = isAuthEndpoint ? '' : this.apiVersion;
    let url = `${this.baseUrl}${versionPrefix}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const makeRequest = async (isRetry = false): Promise<T> => {
      const token = this.getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...init.headers,
      };

      if (token && !skipAuth) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const abortSignal = signal || controller.signal;

      try {
        const response = await fetch(url, {
          ...init,
          headers,
          signal: abortSignal,
          credentials: 'include', // Include cookies for httpOnly refresh token
        });
        clearTimeout(timeoutId);

        // Handle 401 Unauthorized - try to refresh token
        if (response.status === 401 && !skipAuth && !isRetry) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry with new token
            return makeRequest(true);
          } else {
            // Redirect to login
            if (typeof window !== 'undefined') {
              const locale = window.location.pathname.split('/')[1] || 'zh';
              window.location.href = `/${locale}/login`;
            }
            throw new Error('Session expired');
          }
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Request failed' }));
          const errorMessage = error.message || `HTTP ${response.status}`;

          if (response.status === 403) {
            toast.error('没有权限执行此操作');
          } else if (response.status === 404) {
            // Don't show toast for 404
          } else if (response.status >= 500) {
            toast.error('服务器错误，请稍后重试');
          }

          throw new Error(errorMessage);
        }

        // Handle empty response
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        return JSON.parse(text);
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`请求超时 (${timeout / 1000}s)`);
        }

        throw error;
      }
    };

    // Retry logic for network errors
    for (let i = 0; i <= retries; i++) {
      try {
        return await makeRequest();
      } catch (error: unknown) {
        if (i < retries && error instanceof Error && error.message.includes('fetch')) {
          console.warn(`Request to ${endpoint} failed, retrying...`);
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
}

export const apiClient = new ApiClient(API_BASE_URL, API_VERSION);
