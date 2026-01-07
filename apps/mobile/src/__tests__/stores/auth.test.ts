import { act } from '@testing-library/react-native';
import { useAuthStore } from '@/stores/auth';

// Mock the secure store
jest.mock('@/lib/storage/secure-store', () => ({
  saveTokens: jest.fn(),
  clearAuthData: jest.fn(),
  saveUser: jest.fn(),
  getUser: jest.fn(),
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
}));

// Mock the API client
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    setOnRefreshFailed: jest.fn(),
  },
}));

import { saveTokens, clearAuthData, saveUser, getUser, getAccessToken } from '@/lib/storage/secure-store';
import { apiClient } from '@/lib/api/client';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });
    
    jest.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  it('login updates state correctly', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      role: 'USER' as const,
      emailVerified: true,
      locale: 'en',
    };
    
    const mockResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: mockUser,
    };

    (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

    await act(async () => {
      await useAuthStore.getState().login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    const state = useAuthStore.getState();
    
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(saveTokens).toHaveBeenCalledWith('access-token', 'refresh-token');
    expect(saveUser).toHaveBeenCalledWith(mockUser);
  });

  it('logout clears state correctly', async () => {
    // Set initial authenticated state
    useAuthStore.setState({
      user: { id: '1', email: 'test@example.com', role: 'USER', emailVerified: true, locale: 'en' },
      isAuthenticated: true,
      isLoading: false,
    });

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(clearAuthData).toHaveBeenCalled();
  });

  it('loadAuth restores session from storage', async () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      role: 'USER' as const,
      emailVerified: true,
      locale: 'en',
    };

    (getAccessToken as jest.Mock).mockResolvedValue('stored-token');
    (getUser as jest.Mock).mockResolvedValue(mockUser);
    (apiClient.get as jest.Mock).mockResolvedValue(mockUser);

    await act(async () => {
      await useAuthStore.getState().loadAuth();
    });

    const state = useAuthStore.getState();
    
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('loadAuth clears state when no token', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    (getUser as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      await useAuthStore.getState().loadAuth();
    });

    const state = useAuthStore.getState();
    
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('setUser updates user and authentication state', () => {
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      role: 'USER' as const,
      emailVerified: true,
      locale: 'en',
    };

    act(() => {
      useAuthStore.getState().setUser(mockUser);
    });

    const state = useAuthStore.getState();
    
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('setUser clears authentication when user is null', () => {
    // First set a user
    useAuthStore.setState({
      user: { id: '1', email: 'test@example.com', role: 'USER', emailVerified: true, locale: 'en' },
      isAuthenticated: true,
    });

    act(() => {
      useAuthStore.getState().setUser(null);
    });

    const state = useAuthStore.getState();
    
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});




