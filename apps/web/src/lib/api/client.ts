import { toast } from 'sonner';
import { normalizeLocale, toBcp47, type SupportedLocale } from '@study-abroad/shared';
import { useAuthStore } from '@/stores/auth';
import { env } from '@/lib/env';
import { ApiError } from './api-error';
import { mapApiErrorToKey } from './api-error-map';
import { API_ERROR_MESSAGES } from './api-error-i18n';

// ============================================
// 非 React 上下文翻译（与 error-boundary / not-found 一致的模式）
// ============================================
const API_I18N = {
  zh: {
    forbidden: '没有权限执行此操作',
    rateLimited: '请求过于频繁，请稍后再试',
    serverError: '服务器错误，请稍后重试',
    requestTimeout: '请求超时 ({seconds}s)',
    networkError: '网络连接失败，正在重试...',
    operationFailed: '操作失败，请重试',
  },
  en: {
    forbidden: 'You do not have permission to perform this action',
    rateLimited: 'Too many requests, please try again later',
    serverError: 'Server error, please try again later',
    requestTimeout: 'Request timed out ({seconds}s)',
    networkError: 'Network connection failed, retrying...',
    operationFailed: 'Operation failed, please try again',
  },
} as const;

function getApiLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'zh';
  const pathLocale = window.location.pathname.split('/')[1];
  const userLocale = useAuthStore.getState().user?.locale;
  return normalizeLocale([pathLocale, userLocale, window.navigator.language]);
}

// API 请求通过 Next.js rewrites 代理（同源），避免跨域 cookie 问题
const RESOLVED_API_URL = '';
const DIRECT_API_URL = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
const API_VERSION = '/api/v1';

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  /**
   * Number of automatic retries on transient failures (network errors,
   * 502/503/504, or AbortError due to timeout). Default 2 for GET
   * requests (3 total attempts), 0 for POST/PUT/PATCH/DELETE.
   *
   * 2026-05 Phase 5 #42: previously default was 1 for all methods,
   * which silently retried non-idempotent mutations on transient errors
   * — a real correctness risk (duplicate writes). Now non-idempotent
   * methods must explicitly opt in by passing `retries: N`.
   */
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
  directApi?: boolean;
  skipApiVersion?: boolean;
  suppressErrorToast?: boolean;
}

// 2026-05 Phase 5 #42: retry policy.
// - Exponential backoff with jitter: 200ms × 2^i ± 25%
// - Max delay capped at 4s so total retry budget stays under ~8s
// - HTTP statuses considered transient (worth retrying)
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 4000;
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function computeBackoffDelay(attempt: number): number {
  const base = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  // ±25% jitter — prevents thundering herd when many clients retry in sync
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

interface RetryableError {
  retryable: true;
  reason: 'network' | 'timeout' | 'http-5xx';
}

interface NonRetryableError {
  retryable: false;
}

type ErrorClassification = RetryableError | NonRetryableError;

function classifyError(error: unknown): ErrorClassification {
  // TypeError 'Failed to fetch' = network down / DNS / CORS — retryable
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return { retryable: true, reason: 'network' };
  }
  // Our timeout path throws a plain Error after AbortError — retryable
  if (error instanceof Error && /timed out/i.test(error.message)) {
    return { retryable: true, reason: 'timeout' };
  }
  // 502/503/504 surface as ApiError with statusCode — retryable
  if (error instanceof ApiError && TRANSIENT_HTTP_STATUSES.has(error.statusCode)) {
    return { retryable: true, reason: 'http-5xx' };
  }
  return { retryable: false };
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
      // 2026-05 Phase 5 #42: idempotency-aware default. GET/HEAD/OPTIONS
      // default to 2 retries; mutating methods default to 0 unless the
      // caller explicitly opts in (e.g. a known-idempotent PUT).
      retries: explicitRetries,
      timeout = 15000,
      signal,
      skipAuth: explicitSkipAuth,
      directApi = false,
      skipApiVersion = false,
      suppressErrorToast = false,
      ...init
    } = config;
    const method = (init.method || 'GET').toUpperCase();
    const retries = explicitRetries ?? (IDEMPOTENT_METHODS.has(method) ? 2 : 0);
    // 自动为认证端点跳过 Token 逻辑（防御性编程，即使调用者忘记传 skipAuth 也不会出错）
    const skipAuth = explicitSkipAuth || this.isAuthEndpoint(endpoint);

    // 所有 endpoint 使用 API 版本前缀
    const versionPrefix = skipApiVersion ? '' : this.apiVersion;
    const requestBaseUrl = directApi && DIRECT_API_URL ? DIRECT_API_URL : this.baseUrl;
    let url = `${requestBaseUrl}${versionPrefix}${endpoint}`;
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
      const isFormData = init.body instanceof FormData;
      const locale = getApiLocale();
      const headers: HeadersInit = {
        // Skip Content-Type for FormData — browser sets multipart boundary automatically
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        'X-Locale': locale,
        'Accept-Language': toBcp47(locale),
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
          const rawMsg = error.error?.message || error.message || `HTTP ${response.status}`;
          const errorMessage = Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg;
          const errorCode = error.error?.code as string | undefined;
          const errorDetails = error.error?.details as Record<string, unknown> | undefined;

          const i18n = API_I18N[locale];

          // 特定状态码由 API client 直接弹 toast（全局处理器会跳过这些状态码）
          if (!suppressErrorToast && response.status === 403) {
            toast.error(i18n.forbidden);
          } else if (response.status === 404) {
            // 404 不显示 toast
          } else if (!suppressErrorToast && response.status === 429) {
            toast.error(i18n.rateLimited);
          } else if (!suppressErrorToast && response.status >= 500) {
            toast.error(i18n.serverError);
          }

          // 翻译错误消息用于用户展示
          const errorKey = mapApiErrorToKey(errorMessage);
          const displayMessage = errorKey
            ? (API_ERROR_MESSAGES[locale][errorKey] ?? i18n.operationFailed)
            : i18n.operationFailed;

          throw new ApiError(
            errorMessage,
            displayMessage,
            response.status,
            errorCode,
            errorDetails
          );
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

    // 2026-05 Phase 5 #42: transient-failure retry loop.
    // Retries are exponential-backoff (200ms × 2^i ± 25% jitter, capped
    // at 4s). Only network errors, timeouts, and 502/503/504 are
    // retried. Idempotency is enforced by the caller via the explicit
    // `retries` knob (GET/HEAD/OPTIONS default 2; mutations default 0).
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await makeRequest();
      } catch (error: unknown) {
        lastError = error;
        const classification = classifyError(error);
        if (attempt < retries && classification.retryable) {
          await new Promise((resolve) => setTimeout(resolve, computeBackoffDelay(attempt)));
          continue;
        }
        throw error;
      }
    }

    // Unreachable in practice — for-loop always throws or returns.
    throw lastError ?? new Error('Max retries exceeded');
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
   * Supports 401 token refresh retry, timeout, and consistent error handling.
   */
  async upload<T>(endpoint: string, formData: FormData, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
      timeout: config?.timeout ?? 60000, // 60s default for uploads
    });
  }
}

export const apiClient = new ApiClient(RESOLVED_API_URL, API_VERSION);

// Re-export from centralized constants for backward compatibility
export { AI_TIMEOUTS, STALE_TIME } from '@/lib/constants';
