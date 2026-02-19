import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaginatedQuery } from '@/hooks/api/usePaginatedQuery';
import { apiClient } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockGet = apiClient.get as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('usePaginatedQuery', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('returns items from the first page', async () => {
    mockGet.mockResolvedValueOnce({
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    const { result } = renderHook(
      () =>
        usePaginatedQuery<{ id: string; name: string }>({
          queryKey: ['test-items'],
          endpoint: '/test',
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].name).toBe('Item 1');
  });

  it('returns hasNextPage based on pagination', async () => {
    mockGet.mockResolvedValueOnce({
      items: [{ id: '1' }],
      page: 1,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });

    const { result } = renderHook(
      () =>
        usePaginatedQuery<{ id: string }>({
          queryKey: ['test-hasnext'],
          endpoint: '/test',
          limit: 1,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  it('returns hasNextPage false on the last page', async () => {
    mockGet.mockResolvedValueOnce({
      items: [{ id: '1' }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    const { result } = renderHook(
      () =>
        usePaginatedQuery<{ id: string }>({
          queryKey: ['test-lastpage'],
          endpoint: '/test',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasNextPage).toBe(false);
  });

  it('does not fetch when enabled is false', async () => {
    const { result } = renderHook(
      () =>
        usePaginatedQuery<{ id: string }>({
          queryKey: ['test-disabled'],
          endpoint: '/test',
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it('exposes error when the query fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(
      () =>
        usePaginatedQuery<{ id: string }>({
          queryKey: ['test-error'],
          endpoint: '/test',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.items).toEqual([]);
  });

  it('passes params to the API call', async () => {
    mockGet.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });

    renderHook(
      () =>
        usePaginatedQuery<{ id: string }>({
          queryKey: ['test-params'],
          endpoint: '/schools',
          params: { search: 'MIT', sort: 'name' },
          limit: 10,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    expect(mockGet).toHaveBeenCalledWith('/schools', {
      params: {
        page: 1,
        limit: 10,
        search: 'MIT',
        sort: 'name',
      },
    });
  });
});
