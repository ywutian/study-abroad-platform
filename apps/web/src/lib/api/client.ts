import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';

// API URL 验证
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL && typeof window !== 'undefined') {
  console.error(
    '[API Client] NEXT_PUBLIC_API_URL 环境变量未设置，使用默认值 http://localhost:3006'
  );
}
const RESOLVED_API_URL = API_BASE_URL || 'http://localhost:3006';
const API_VERSION = '/api/v1';

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

/**
 * API 客户端
 * 
 * 安全特性：
 * - 所有请求携带 credentials: 'include' 以发送 httpOnly cookie
 * - AccessToken 从内存中获取（不持久化）
 * - 401 时自动尝试使用 Cookie 刷新 Token
 * - 刷新失败时自动登出并跳转登录页
 */
class ApiClient {
  private baseUrl: string;
  private apiVersion: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private pendingRequests: Array<{
    resolve: (value: boolean) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  constructor(baseUrl: string, apiVersion: string = '') {
    this.baseUrl = baseUrl;
    this.apiVersion = apiVersion;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return useAuthStore.getState().accessToken;
  }

  private async refreshToken(): Promise<boolean> {
    // 防止并发刷新：所有等待中的请求共享同一个刷新 Promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      const result = await this.refreshPromise;
      // 通知所有等待的请求
      this.pendingRequests.forEach(({ resolve }) => resolve(result));
      this.pendingRequests = [];
      return result;
    } catch (error) {
      this.pendingRequests.forEach(({ reject }) => reject(error));
      this.pendingRequests = [];
      throw error;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    return useAuthStore.getState().refreshAccessToken();
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, retries = 1, timeout = 15000, signal, skipAuth = false, ...init } = config;

    // 所有 endpoint 使用 API 版本前缀
    const versionPrefix = this.apiVersion;
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

      // 从内存中获取 AccessToken
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
          credentials: 'include', // 关键：发送 httpOnly cookie
        });
        clearTimeout(timeoutId);

        // 处理 401 Unauthorized - 尝试刷新 Token
        if (response.status === 401 && !skipAuth && !isRetry) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // 使用新 Token 重试请求
            return makeRequest(true);
          } else {
            // 刷新失败，跳转到登录页
            this.redirectToLogin();
            throw new Error('Session expired');
          }
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Request failed' }));
          const errorMessage = error.error?.message || error.message || `HTTP ${response.status}`;

          if (response.status === 403) {
            toast.error('没有权限执行此操作');
          } else if (response.status === 404) {
            // 404 不显示 toast
          } else if (response.status >= 500) {
            toast.error('服务器错误，请稍后重试');
          }

          throw new Error(errorMessage);
        }

        // 处理空响应
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        const json = JSON.parse(text);
        // 后端标准响应格式: { success: true, data: {...} }
        // 返回 data 字段内容，否则返回整个响应
        return json.data !== undefined ? json.data : json;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`请求超时 (${timeout / 1000}s)`);
        }

        throw error;
      }
    };

    // 网络错误重试逻辑
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

  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      const locale = window.location.pathname.split('/')[1] || 'zh';
      window.location.href = `/${locale}/login`;
    }
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

export const apiClient = new ApiClient(RESOLVED_API_URL, API_VERSION);
