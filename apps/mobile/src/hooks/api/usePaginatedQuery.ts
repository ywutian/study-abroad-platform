import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { cachePolicy, type CacheTier } from '@/lib/query';
import type { PaginatedResponse } from '@/types';

interface UsePaginatedQueryOptions {
  /** Query key (use the `qk` factory). Accepts readonly tuples from `as const`. */
  queryKey: readonly unknown[];
  /** API endpoint path (e.g. '/schools') */
  endpoint: string;
  /** Query params to send with each request (page & pageSize are added automatically) */
  params?: Record<string, unknown>;
  /** Items per page (default: 20). Sent as pageSize to match current API pagination DTOs. */
  limit?: number;
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Declare the data class instead of raw numbers — spreads `cachePolicy[cacheTier]`.
   *  e.g. `reference` for a catalog so revisits are instant. Mirrors the web `useListQuery`. */
  cacheTier?: CacheTier;
  /** Override how long results stay fresh (ms). Takes precedence over `cacheTier`. */
  staleTime?: number;
  /** Override garbage-collection time (ms). Takes precedence over `cacheTier`. */
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
  cacheTier,
  staleTime,
  gcTime,
}: UsePaginatedQueryOptions) {
  const policy = cacheTier ? cachePolicy[cacheTier] : undefined;
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
    staleTime: staleTime ?? policy?.staleTime,
    gcTime: gcTime ?? policy?.gcTime,
    placeholderData: keepPreviousData,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  /** Total matching records reported by the first page (for "N results" headers). */
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    items,
    total,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
