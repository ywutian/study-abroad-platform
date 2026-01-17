import { create } from 'zustand';
import {
  saveTokens,
  clearAuthData,
  saveUser,
  getUser,
  getAccessToken,
  getRefreshToken,
} from '@/lib/storage/secure-store';
import { apiClient } from '@/lib/api/client';
import type { User, AuthResponse, LoginDto, RegisterDto } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (dto: LoginDto) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', dto, { skipAuth: true });

    await saveTokens(response.accessToken, response.refreshToken);
    await saveUser(response.user);

    set({
      user: response.user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (dto: RegisterDto) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', dto, { skipAuth: true });

    await saveTokens(response.accessToken, response.refreshToken);
    await saveUser(response.user);

    set({
      user: response.user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();

    // Call logout API
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch {
        // Ignore logout API errors
      }
    }

    await clearAuthData();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadAuth: async () => {
    set({ isLoading: true });

    try {
      const [token, user] = await Promise.all([getAccessToken(), getUser<User>()]);

      if (token && user) {
        // Verify token is still valid
        try {
          const freshUser = await apiClient.get<User>('/auth/me');
          await saveUser(freshUser);
          set({ user: freshUser, isAuthenticated: true, isLoading: false });
        } catch {
          // Token invalid, clear auth
          await clearAuthData();
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      await clearAuthData();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));

// Set up refresh failed callback
apiClient.setOnRefreshFailed(() => {
  useAuthStore.getState().logout();
});
