import type { QueryClient } from '@tanstack/react-query';

/**
 * Lightweight React Query cache-hit observability.
 *
 * Subscribes to the QueryCache and, per top-level key prefix (schools, school-list,
 * cases, predictions, …), counts how often a screen *reads* a query vs how often
 * that read had to hit the *network*. A high read:fetch ratio means the cache is
 * doing its job. Counting is O(1) per event, so it's always on; read the numbers on
 * demand via `getCacheStats()` (wire to a dev overlay or a Sentry breadcrumb) instead
 * of spamming the console.
 */
interface PrefixStats {
  /** Components that subscribed to a query under this prefix. */
  reads: number;
  /** Network fetches actually issued under this prefix. */
  fetches: number;
}

const stats = new Map<string, PrefixStats>();

function prefixOf(queryKey: readonly unknown[]): string {
  return typeof queryKey[0] === 'string' ? queryKey[0] : 'other';
}

function bump(prefix: string, field: keyof PrefixStats): void {
  const current = stats.get(prefix) ?? { reads: 0, fetches: 0 };
  current[field] += 1;
  stats.set(prefix, current);
}

export interface CacheStat extends PrefixStats {
  /** 0–1: share of reads served without a network fetch. */
  hitRate: number;
}

export function getCacheStats(): Record<string, CacheStat> {
  const out: Record<string, CacheStat> = {};
  for (const [prefix, s] of stats) {
    const hitRate = s.reads > 0 ? Math.max(0, 1 - s.fetches / s.reads) : 0;
    out[prefix] = { ...s, hitRate: Math.round(hitRate * 100) / 100 };
  }
  return out;
}

export function resetCacheStats(): void {
  stats.clear();
}

/**
 * Attach the metrics collector to a QueryClient. Returns an unsubscribe fn.
 */
export function attachCacheMetrics(queryClient: QueryClient): () => void {
  const cache = queryClient.getQueryCache();

  const unsubscribe = cache.subscribe((event) => {
    const prefix = prefixOf(event.query.queryKey);
    if (event.type === 'observerAdded') {
      bump(prefix, 'reads');
    } else if (event.type === 'updated' && event.action?.type === 'fetch') {
      bump(prefix, 'fetches');
    }
  });

  return unsubscribe;
}
