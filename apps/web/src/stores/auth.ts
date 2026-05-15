import { create } from 'zustand';
import { normalizeLocale, toBcp47, type Role } from '@study-abroad/shared';

interface User {
  id: string;
  email: string;
  role: `${Role}`;
  emailVerified: boolean;
  locale: string;
  profile?: {
    nickname?: string | null;
    avatarUrl?: string | null;
    realName?: string | null;
  } | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  initialize: () => Promise<void>;
}

// API 请求通过 Next.js rewrites 代理（同源），避免跨域 cookie 问题
const API_BASE_URL = '';

function getLocaleHeaders(userLocale?: string): Record<string, string> {
  const pathLocale =
    typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : undefined;
  const browserLocale = typeof window !== 'undefined' ? window.navigator.language : undefined;
  const locale = normalizeLocale([pathLocale, userLocale, browserLocale]);
  return {
    'X-Locale': locale,
    'Accept-Language': toBcp47(locale),
  };
}

/**
 * 安全认证 Store
 *
 * 安全设计：
 * - AccessToken 仅存储在内存中，不持久化到 localStorage
 * - RefreshToken 通过 httpOnly cookie 管理，JavaScript 无法访问
 * - 页面刷新后通过 Cookie 自动恢复会话
 *
 * 这样即使存在 XSS 漏洞，攻击者也无法窃取 Token
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null, // 仅存内存，不持久化
  isLoading: true,
  isRefreshing: false,
  isInitialized: false,

  setUser: (user) => set({ user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  setLoading: (isLoading) => set({ isLoading }),

  /**
   * 初始化认证状态
   * 页面加载时调用，尝试使用 httpOnly cookie 中的 refreshToken 恢复会话
   */
  initialize: async () => {
    const { isInitialized, refreshAccessToken } = get();

    if (isInitialized) {
      return;
    }

    set({ isLoading: true });

    try {
      // Try to restore session using the httpOnly refreshToken cookie.
      // The cookie is sent automatically by the browser — no JS-readable
      // hint cookie needed.
      const success = await refreshAccessToken();

      if (success) {
        const userResponse = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          headers: {
            ...getLocaleHeaders(),
            Authorization: `Bearer ${get().accessToken}`,
          },
          credentials: 'include',
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          set({ user: userData.data || userData });
        }
      }
    } catch {
      set({ user: null, accessToken: null });
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  /**
   * 登出
   * 调用后端 API 使 refreshToken 失效，清除 cookie
   */
  logout: async () => {
    const { accessToken } = get();

    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getLocaleHeaders(get().user?.locale),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include', // 发送 httpOnly cookie
      });
    } catch {
      // 即使 API 调用失败，也要清除本地状态
    }

    set({ user: null, accessToken: null });
  },

  /**
   * 刷新 AccessToken
   * 使用 httpOnly cookie 中的 refreshToken（由浏览器自动发送）
   * 并发安全：多个调用者共享同一个 in-flight Promise
   */
  refreshAccessToken: async () => {
    const { isRefreshing } = get();

    // 如果已在刷新中，等待现有刷新完成（而非立即返回 false）
    if (isRefreshing) {
      return new Promise<boolean>((resolve) => {
        // Timeout prevents infinite hang if refresh never completes
        const timeoutId = setTimeout(() => {
          unsubscribe();
          resolve(false);
        }, 10000);
        const unsubscribe = useAuthStore.subscribe((state) => {
          if (!state.isRefreshing) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(!!state.accessToken);
          }
        });
      });
    }

    set({ isRefreshing: true });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getLocaleHeaders(get().user?.locale) },
        body: JSON.stringify({}), // 空 body，refreshToken 通过 cookie 发送
        credentials: 'include', // 关键：发送 httpOnly cookie
      });

      if (!response.ok) {
        // RefreshToken 无效或过期
        set({ user: null, accessToken: null, isRefreshing: false });
        return false;
      }

      const data = await response.json();
      const newAccessToken = data.data?.accessToken || data.accessToken;

      set({
        accessToken: newAccessToken,
        isRefreshing: false,
      });

      return true;
    } catch {
      set({ user: null, accessToken: null, isRefreshing: false });
      return false;
    }
  },
}));

// 自动刷新 Token（在过期前刷新）
let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefreshInterval() {
  // 每 14 分钟刷新一次（假设 accessToken 15 分钟过期）
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(
    () => {
      const { accessToken, refreshAccessToken } = useAuthStore.getState();
      if (accessToken) {
        refreshAccessToken();
      }
    },
    14 * 60 * 1000
  );
}

export function stopTokenRefreshInterval() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

/**
 * 用于登录成功后设置状态的辅助函数
 */
export function setAuthFromLogin(user: User, accessToken: string) {
  useAuthStore.setState({
    user,
    accessToken,
    isLoading: false,
    isInitialized: true,
  });
}
