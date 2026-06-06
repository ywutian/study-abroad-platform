/**
 * Centralised React Query cache tiers.
 *
 * Screens declare a data *class* (`...cachePolicy.reference`) instead of sprinkling
 * magic `staleTime`/`gcTime` numbers, so caching is consistent, reviewable, and tuned
 * to how volatile each kind of data actually is. Spread a tier into a `useQuery` /
 * `useInfiniteQuery` options object:
 *
 *   useQuery({ queryKey: qk.schools.detail(id), queryFn, ...cachePolicy.reference })
 *
 * The global default (set on the QueryClient) is `standard` — only override when a
 * query is meaningfully more static (reference/static) or more volatile (fresh/realtime).
 */

import { QUERY_CACHE_TIERS } from '@study-abroad/shared';

const MINUTE = 1000 * 60;
const HOUR = MINUTE * 60;

// staleTime (the freshness contract) is shared with web via QUERY_CACHE_TIERS so
// the two apps don't drift. gcTime is deliberately LONGER on mobile because the
// app is offline-first (AsyncStorage persists for 24h) and keeps data in memory
// longer — these gcTime values are intentional platform overrides, not drift.
export const cachePolicy = {
  /**
   * Immutable for a session: enums, app config, ranking lists, country filters.
   * Never auto-refetches — only a manual `refetch()` or a cold start re-pulls.
   */
  static: { staleTime: QUERY_CACHE_TIERS.static.staleTime, gcTime: HOUR * 24 },

  /**
   * Rarely changes; revisits should be instant: schools, cases, ranking data.
   * Survives in cache for two hours so navigating away and back never shows a
   * loading skeleton or re-hits the network.
   */
  reference: {
    staleTime: QUERY_CACHE_TIERS.reference.staleTime,
    gcTime: HOUR * 2,
  },

  /**
   * Typical app data: dashboards, profile snapshots, analysis. Matches the global
   * default — listed here so callers can be explicit when it aids readability.
   */
  standard: {
    staleTime: QUERY_CACHE_TIERS.standard.staleTime,
    gcTime: MINUTE * 30,
  },

  /**
   * User-mutable data that must reflect edits promptly: the target school list,
   * prediction results, timeline. staleTime is 0 (INTENTIONAL mobile override —
   * web uses 1m) so edits show instantly; mutations should also `invalidateQueries`.
   */
  fresh: { staleTime: 0, gcTime: MINUTE * 10 },

  /**
   * Live data: notifications, unread counts. Never considered fresh.
   */
  realtime: { staleTime: QUERY_CACHE_TIERS.realtime.staleTime, gcTime: MINUTE },
} as const;

export type CacheTier = keyof typeof cachePolicy;
