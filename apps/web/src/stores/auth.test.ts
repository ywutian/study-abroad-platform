import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useAuthStore,
  setAuthFromLogin,
  startTokenRefreshInterval as _startTokenRefreshInterval,
  stopTokenRefreshInterval,
} from './auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: true,
      isRefreshing: false,
      isInitialized: false,
    });
    mockFetch.mockReset();
    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    stopTokenRefreshInterval();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.isRefreshing).toBe(false);
    expect(state.isInitialized).toBe(false);
  });

  it('setUser updates user', () => {
    const user = {
      id: '1',
      email: 'test@test.com',
      role: 'USER' as const,
      emailVerified: true,
      locale: 'zh',
    };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('setAccessToken updates token', () => {
    useAuthStore.getState().setAccessToken('new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('setLoading updates loading state', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  describe('initialize', () => {
    it('skips refresh when no auth_check cookie', async () => {
      document.cookie = '';
      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not re-initialize if already initialized', async () => {
      useAuthStore.setState({ isInitialized: true });
      await useAuthStore.getState().initialize();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('attempts refresh when auth_check cookie exists', async () => {
      document.cookie = 'auth_check=1';

      // Mock refresh endpoint
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { accessToken: 'new-token' } }),
        })
        // Mock users/me endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: '1',
                email: 'test@test.com',
                role: 'USER',
                emailVerified: true,
                locale: 'zh',
              },
            }),
        });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().user).not.toBeNull();
      expect(useAuthStore.getState().accessToken).toBe('new-token');
    });

    it('clears state on failed initialization', async () => {
      document.cookie = 'auth_check=1';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('logout', () => {
    it('calls logout API and clears state', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'test@test.com', role: 'USER', emailVerified: true, locale: 'zh' },
        accessToken: 'token-123',
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await useAuthStore.getState().logout();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      );
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it('clears state even if logout API fails', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'x@x.com', role: 'USER', emailVerified: true, locale: 'zh' },
        accessToken: 'tok',
      });
      mockFetch.mockRejectedValueOnce(new Error('fail'));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes token successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { accessToken: 'refreshed-token' } }),
      });

      const result = await useAuthStore.getState().refreshAccessToken();

      expect(result).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
      expect(useAuthStore.getState().isRefreshing).toBe(false);
    });

    it('returns false on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await useAuthStore.getState().refreshAccessToken();

      expect(result).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isRefreshing).toBe(false);
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await useAuthStore.getState().refreshAccessToken();

      expect(result).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it('deduplicates concurrent refresh calls', async () => {
      let resolveRefresh: (value: unknown) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      mockFetch.mockReturnValueOnce(
        refreshPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({ data: { accessToken: 'deduped-token' } }),
        }))
      );

      // Start two concurrent refreshes
      const promise1 = useAuthStore.getState().refreshAccessToken();
      const promise2 = useAuthStore.getState().refreshAccessToken();

      // Resolve the fetch
      resolveRefresh!(undefined);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should succeed but only one fetch call should be made
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('setAuthFromLogin', () => {
    it('sets user, token, and cookie', () => {
      const user = {
        id: '1',
        email: 'test@test.com',
        role: 'USER' as const,
        emailVerified: true,
        locale: 'zh',
      };
      setAuthFromLogin(user, 'login-token');

      expect(useAuthStore.getState().user).toEqual(user);
      expect(useAuthStore.getState().accessToken).toBe('login-token');
      expect(useAuthStore.getState().isLoading).toBe(false);
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(document.cookie).toContain('auth_check=1');
    });
  });
});
