import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: 'USER' | 'VERIFIED' | 'ADMIN';
  emailVerified: boolean;
  locale: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string | null, refreshToken: string | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: true,
      isRefreshing: false,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () => {
        const { refreshToken } = get();
        // Call logout API if we have a refresh token
        if (refreshToken) {
          fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }).catch(() => {
            // Ignore logout API errors
          });
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshAccessToken: async () => {
        const { refreshToken, isRefreshing } = get();

        // Prevent concurrent refresh calls
        if (isRefreshing || !refreshToken) {
          return false;
        }

        set({ isRefreshing: true });

        try {
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) {
            // Refresh token expired or invalid
            get().logout();
            return false;
          }

          const data = await response.json();
          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isRefreshing: false,
          });
          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        } finally {
          set({ isRefreshing: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

// Auto refresh token before expiry
let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefreshInterval() {
  // Refresh every 14 minutes (assuming 15min access token expiry)
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(() => {
    const { accessToken, refreshAccessToken } = useAuthStore.getState();
    if (accessToken) {
      refreshAccessToken();
    }
  }, 14 * 60 * 1000);
}

export function stopTokenRefreshInterval() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
