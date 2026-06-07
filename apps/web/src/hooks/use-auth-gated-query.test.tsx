import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthReady, useAuthGatedQuery } from './use-auth-gated-query';
import { useAuthStore } from '@/stores/auth';

describe('useAuthReady', () => {
  beforeEach(() => {
    useAuthStore.setState({ isInitialized: false, accessToken: null });
  });

  it('is false before initialization, even with a token in memory', () => {
    useAuthStore.setState({ isInitialized: false, accessToken: 'tok' });
    expect(renderHook(() => useAuthReady()).result.current).toBe(false);
  });

  it('is false when initialized but no token (logged out)', () => {
    useAuthStore.setState({ isInitialized: true, accessToken: null });
    expect(renderHook(() => useAuthReady()).result.current).toBe(false);
  });

  it('is true only when initialized AND a token is present', () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 'tok' });
    expect(renderHook(() => useAuthReady()).result.current).toBe(true);
  });
});

describe('useAuthGatedQuery', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  it('does not fire the queryFn until auth is ready (the 401-race guard)', async () => {
    useAuthStore.setState({ isInitialized: false, accessToken: null });
    const queryFn = vi.fn().mockResolvedValue('data');
    renderHook(() => useAuthGatedQuery({ queryKey: ['gated'], queryFn }), {
      wrapper,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('fires once auth is ready', async () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 'tok' });
    const queryFn = vi.fn().mockResolvedValue('data');
    renderHook(() => useAuthGatedQuery({ queryKey: ['gated2'], queryFn }), {
      wrapper,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('still respects a caller-supplied enabled:false', async () => {
    useAuthStore.setState({ isInitialized: true, accessToken: 'tok' });
    const queryFn = vi.fn().mockResolvedValue('data');
    renderHook(() => useAuthGatedQuery({ queryKey: ['gated3'], queryFn, enabled: false }), {
      wrapper,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(queryFn).not.toHaveBeenCalled();
  });
});
