import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types';

interface UsePaginatedQueryOptions {
  /** Query key array (e.g. ['schools', search, sort]) */
  queryKey: unknown[];
  /** API endpoint path (e.g. '/schools') */
  endpoint: string;
  /** Query params to send with each request (page & limit are added automatically) */
  params?: Record<string, unknown>;
  /** Items per page (default: 20) */
  limit?: number;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Encapsulates the cursor-based infinite query pattern used across list screens.
 * Handles pagination via `page` param with `PaginatedResponse<T>` shape.
 */
export function usePaginatedQuery<T>({
  queryKey,
  endpoint,
  params = {},
  limit = 20,
  enabled = true,
}: UsePaginatedQueryOptions) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      return apiClient.get<PaginatedResponse<T>>(endpoint, {
        params: {
          page: pageParam,
          limit,
          ...params,
        },
      });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
