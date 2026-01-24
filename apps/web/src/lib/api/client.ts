import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';

// ============================================
// 非 React 上下文翻译（与 error-boundary / not-found 一致的模式）
// ============================================
const API_I18N = {
  zh: {
    forbidden: '没有权限执行此操作',
    serverError: '服务器错误，请稍后重试',
    requestTimeout: '请求超时 ({seconds}s)',
    networkError: '网络连接失败，正在重试...',
  },
  en: {
    forbidden: 'You do not have permission to perform this action',
    serverError: 'Server error, please try again later',
    requestTimeout: 'Request timed out ({seconds}s)',
    networkError: 'Network connection failed, retrying...',
  },
} as const;

function getApiLocale(): 'zh' | 'en' {
  if (typeof window === 'undefined') return 'en';
  const path = window.location.pathname;
  if (path.startsWith('/zh')) return 'zh';
  return 'en';
}

// API 请求通过 Next.js rewrites 代理（同源），避免跨域 cookie 问题
const RESOLVED_API_URL = '';
const API_VERSION = '/api/v1';

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
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

  // 认证相关端点：401 表示"凭证错误"而非"会话过期"，不应触发 Token 刷新
  private static readonly AUTH_ENDPOINTS = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/resend-verification',
  ];

  constructor(baseUrl: string, apiVersion: string = '') {
    this.baseUrl = baseUrl;
    this.apiVersion = apiVersion;
  }

  private isAuthEndpoint(endpoint: string): boolean {
    return ApiClient.AUTH_ENDPOINTS.some((p) => endpoint === p || endpoint.startsWith(p + '?'));
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return useAuthStore.getState().accessToken;
  }

  // 委托给 auth store，store 内部已处理并发去重
  private async refreshToken(): Promise<boolean> {
    return useAuthStore.getState().refreshAccessToken();
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const {
      params,
      retries = 1,
      timeout = 15000,
      signal,
      skipAuth: explicitSkipAuth,
      ...init
    } = config;
    // 自动为认证端点跳过 Token 逻辑（防御性编程，即使调用者忘记传 skipAuth 也不会出错）
    const skipAuth = explicitSkipAuth || this.isAuthEndpoint(endpoint);

    // 所有 endpoint 使用 API 版本前缀
    const versionPrefix = this.apiVersion;
    let url = `${this.baseUrl}${versionPrefix}${endpoint}`;
    if (params) {
      const filteredParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          filteredParams[key] = String(value);
        }
      });
      const searchParams = new URLSearchParams(filteredParams);
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

          const i18n = API_I18N[getApiLocale()];
          if (response.status === 403) {
            toast.error(i18n.forbidden);
          } else if (response.status === 404) {
            // 404 不显示 toast
          } else if (response.status >= 500) {
            toast.error(i18n.serverError);
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
          const i18n = API_I18N[getApiLocale()];
          throw new Error(i18n.requestTimeout.replace('{seconds}', String(timeout / 1000)));
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

  /**
   * 上传文件（FormData）
   * 不设置 Content-Type，让浏览器自动设置 multipart/form-data boundary
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${this.apiVersion}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.error?.message || error.message || `HTTP ${response.status}`);
    }

    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }
}

export const apiClient = new ApiClient(RESOLVED_API_URL, API_VERSION);
