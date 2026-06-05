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

const MINUTE = 1000 * 60;
const HOUR = MINUTE * 60;

export const cachePolicy = {
  /**
   * Immutable for a session: enums, app config, ranking lists, country filters.
   * Never auto-refetches — only a manual `refetch()` or a cold start re-pulls.
   */
  static: { staleTime: Infinity, gcTime: HOUR * 24 },

  /**
   * Rarely changes; revisits should be instant: schools, cases, ranking data.
   * Stays fresh for an hour and survives in cache for two, so navigating away and
   * back never shows a loading skeleton or re-hits the network.
   */
  reference: { staleTime: HOUR, gcTime: HOUR * 2 },

  /**
   * Typical app data: dashboards, profile snapshots, analysis. Matches the global
   * default — listed here so callers can be explicit when it aids readability.
   */
  standard: { staleTime: MINUTE * 5, gcTime: MINUTE * 30 },

  /**
   * User-mutable data that must reflect edits promptly: the target school list,
   * prediction results, timeline. Always revalidates on mount; mutations should also
   * `invalidateQueries` the matching key for an immediate update.
   */
  fresh: { staleTime: 0, gcTime: MINUTE * 10 },

  /**
   * Live data: notifications, unread counts. Never considered fresh.
   */
  realtime: { staleTime: 0, gcTime: MINUTE },
} as const;

export type CacheTier = keyof typeof cachePolicy;
