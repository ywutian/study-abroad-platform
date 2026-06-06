/**
 * React Query cache tiers — shared source of truth for web + mobile (milliseconds).
 *
 * These are the canonical (web / online) baseline values. Web's `STALE_TIME` /
 * `GC_TIME` derive from here; mobile spreads them and applies a few documented
 * platform overrides. Keeping the freshness contract (`staleTime`) shared stops
 * the two apps from silently drifting apart.
 *
 * INTENTIONAL platform differences (preserve these — they are NOT drift):
 *   1. Mobile `gcTime` is generally LONGER. The app is offline-first
 *      (AsyncStorage persists for 24h), so it keeps data in memory longer.
 *   2. Mobile `fresh.staleTime` is 0 (instant revalidation of user-mutable
 *      lists) vs 1m on web (forum / notification semantics).
 *   3. Query-key naming: web uses plural `['school-lists']`, mobile singular
 *      `['school-list']` — each internally consistent, different backends.
 */

const MINUTE = 60 * 1000;

export const QUERY_CACHE_TIERS = {
  /** Immutable for a session: enums, app config, ranking lists, country filters. */
  static: { staleTime: Number.POSITIVE_INFINITY, gcTime: 30 * MINUTE },
  /** Rarely changes; revisits should be instant: schools, cases, rankings. */
  reference: { staleTime: 30 * MINUTE, gcTime: 30 * MINUTE },
  /** Typical app data (global default): dashboards, profile, AI analysis. */
  standard: { staleTime: 5 * MINUTE, gcTime: 10 * MINUTE },
  /** User-mutable, reflect edits promptly: school list, forum, essays, timeline. */
  fresh: { staleTime: 1 * MINUTE, gcTime: 5 * MINUTE },
  /** Live data: notifications, unread counts. Never considered fresh. */
  realtime: { staleTime: 0, gcTime: 5 * MINUTE },
} as const;

export type QueryCacheTier = keyof typeof QUERY_CACHE_TIERS;
