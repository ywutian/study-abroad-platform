/**
 * Centralised React Query cache tiers for the web app.
 *
 * Bundles the existing STALE_TIME + GC_TIME constants into spreadable
 * {staleTime, gcTime} objects so a screen declares a data *class* instead of
 * guessing numbers. Spread a tier into a useQuery options object:
 *
 *   useQuery({ queryKey: qk.cases.list(params), queryFn, ...cachePolicy.reference })
 *
 * Tier names mirror apps/mobile/src/lib/query/cache-policy.ts for cross-platform
 * consistency. The NUMBERS come from lib/constants.ts (single source of truth) —
 * never hardcode staleTime/gcTime in a component.
 *
 * The global QueryClient default == `standard`; only override when the data is
 * more static (reference/static) or more volatile (fresh/realtime).
 *
 * NOTE on web↔mobile divergence: mobile's `fresh` uses staleTime 0; web's `fresh`
 * maps to STALE_TIME.DYNAMIC (1 min) to match the web tier semantics ("forum,
 * notifications"). Only `realtime` is staleTime 0 on web.
 */
import { STALE_TIME, GC_TIME } from '@/lib/constants';

export const cachePolicy = {
  /** Immutable for a session: country filters, ranking-list options, enums. */
  static: { staleTime: STALE_TIME.IMMUTABLE, gcTime: GC_TIME.SCHOOL_RECOMMENDATION }, // ∞ / 30m

  /** Rarely changes; revisits should be instant: schools catalog, cases, rankings, hall. */
  reference: { staleTime: STALE_TIME.STATIC, gcTime: GC_TIME.SCHOOL_RECOMMENDATION }, // 30m / 30m

  /** Typical app data: dashboards, profile snapshots, AI analysis, admin. == global default. */
  standard: { staleTime: STALE_TIME.MODERATE, gcTime: GC_TIME.AI_ANALYSIS }, // 5m / 10m

  /** User-mutable; reflect edits promptly: school list, forum, essays, timeline.
   *  Mutations should also invalidate the matching key for an instant update. */
  fresh: { staleTime: STALE_TIME.DYNAMIC, gcTime: GC_TIME.DEFAULT }, // 1m / 5m

  /** Live data: notifications, unread counts, swipe stats. Never considered fresh. */
  realtime: { staleTime: STALE_TIME.REALTIME, gcTime: GC_TIME.DEFAULT }, // 0 / 5m
} as const;

export type CacheTier = keyof typeof cachePolicy;
