import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PaginatedResponse } from '@/types';
import { qk } from './query-keys';
import { cachePolicy } from './cache-policy';

/**
 * Warm the caches for static reference lists right after the persisted cache is
 * restored, so the *first* time the user opens the Schools tab it's already there
 * (no cold fetch, no skeleton). Keyed + shaped identically to the screen's
 * `usePaginatedQuery` call so the prefetched page is a direct cache hit.
 *
 * Cheap + safe: `prefetchInfiniteQuery` respects `staleTime`, so if the list was
 * just restored from disk (still fresh under the `reference` tier) this is a no-op.
 */
export async function prefetchReferenceData(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.prefetchInfiniteQuery({
      // Must match schools.tsx: qk.schools.list({ search: '' }), page 1, view=list.
      queryKey: qk.schools.list({ search: '' }),
      queryFn: ({ pageParam = 1 }) =>
        apiClient.get<PaginatedResponse<unknown>>('/schools', {
          params: { page: pageParam, pageSize: 20, view: 'list' },
        }),
      initialPageParam: 1,
      staleTime: cachePolicy.reference.staleTime,
    });
  } catch {
    // Prefetch is best-effort warming — never surface an error or block startup.
  }
}
