import { create } from 'zustand';
import {
  saveTokens,
  clearAuthData,
  saveUser,
  getUser,
  getAccessToken,
  getRefreshToken,
} from '@/lib/storage/secure-store';
import { authRoutes, notificationRoutes, userRoutes } from '@study-abroad/shared';
import { apiClient, getApiLocale } from '@/lib/api/client';
import { resetQuerySession } from '@/lib/query-session';
import { clearRegisteredPushToken, getRegisteredPushToken } from '@/lib/storage/push-token';
import type { User, AuthResponse, LoginDto, RegisterDto } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpired: boolean;

  // Actions
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearSessionExpired: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  sessionExpired: false,

  login: async (dto: LoginDto) => {
    const response = await apiClient.post<AuthResponse>(authRoutes.login(), dto, {
      skipAuth: true,
    });

    if (!response.accessToken) {
      throw new Error('Login failed: no access token returned');
    }

    // A previous account may have left in-memory cache behind after a crash.
    await resetQuerySession();
    await saveTokens(response.accessToken, response.refreshToken);
    await saveUser(response.user);

    set({
      user: response.user,
      isAuthenticated: true,
      isLoading: false,
      sessionExpired: false,
    });
  },

  register: async (dto: RegisterDto) => {
    await apiClient.post(
      authRoutes.register(),
      { ...dto, locale: dto.locale ?? getApiLocale() },
      { skipAuth: true }
    );
    // Registration doesn't return tokens — the user needs to verify email then login.
    // The UI should show a success message and redirect to login.
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();

    const pushToken = await getRegisteredPushToken();
    if (pushToken) {
      try {
        await apiClient.delete(notificationRoutes.pushToken(), {
          body: JSON.stringify({ token: pushToken }),
        });
      } catch {
        // Session cleanup must continue even when push-token cleanup is offline.
      } finally {
        await clearRegisteredPushToken();
      }
    }

    // Call logout API
    if (refreshToken) {
      try {
        await apiClient.post(authRoutes.logout(), { refreshToken });
      } catch {
        // Ignore logout API errors
      }
    }

    await clearAuthData();
    await resetQuerySession();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadAuth: async () => {
    set({ isLoading: true });

    try {
      const [token, user] = await Promise.all([getAccessToken(), getUser<User>()]);

      if (token && user) {
        // Verify token is still valid
        try {
          const freshUser = await apiClient.get<User>(userRoutes.me());
          await saveUser(freshUser);
          set({ user: freshUser, isAuthenticated: true, isLoading: false });
        } catch (error: unknown) {
          // Distinguish network errors from auth errors.
          // Network errors: keep cached user data (offline-capable).
          // Auth errors (401/403/Session expired): clear auth.
          const message = error instanceof Error ? error.message : '';
          const isNetworkError =
            message.includes('Network') || message.startsWith('Request timeout');

          if (isNetworkError && user) {
            // Offline — use cached user data
            set({ user, isAuthenticated: true, isLoading: false });
          } else {
            // Token invalid
            await clearAuthData();
            await resetQuerySession();
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        }
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      await clearAuthData();
      await resetQuerySession();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  clearSessionExpired: () => set({ sessionExpired: false }),
}));

// Set up refresh failed callback — signal session expiry instead of
// immediately logging out so the user can be notified first.
apiClient.setOnRefreshFailed(() => {
  void resetQuerySession();
  useAuthStore.setState({ sessionExpired: true, isAuthenticated: false, user: null });
});
