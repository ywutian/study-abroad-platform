import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types';

interface UsePaginatedQueryOptions {
  /** Query key array (e.g. ['schools', search, sort]) */
  queryKey: unknown[];
  /** API endpoint path (e.g. '/schools') */
  endpoint: string;
  /** Query params to send with each request (page & pageSize are added automatically) */
  params?: Record<string, unknown>;
  /** Items per page (default: 20). Sent as pageSize to match current API pagination DTOs. */
  limit?: number;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Override how long results stay fresh (ms). Default: the global 5 min. Pass a
   *  large value for static reference lists so revisits are instant (no refetch). */
  staleTime?: number;
  /** Override garbage-collection time (ms). Default: the global 30 min. */
  gcTime?: number;
}

/**
 * Encapsulates the cursor-based infinite query pattern used across list screens.
 * Handles pagination via `page` param with `PaginatedResponse<T>` shape.
 * Uses `keepPreviousData` so a changing key (e.g. a new search term) keeps the
 * old results on screen instead of flashing the loading skeleton.
 */
export function usePaginatedQuery<T>({
  queryKey,
  endpoint,
  params = {},
  limit = 20,
  enabled = true,
  staleTime,
  gcTime,
}: UsePaginatedQueryOptions) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      return apiClient.get<PaginatedResponse<T>>(endpoint, {
        params: {
          page: pageParam,
          pageSize: limit,
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
    staleTime,
    gcTime,
    placeholderData: keepPreviousData,
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
