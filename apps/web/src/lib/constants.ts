/**
 * Centralized constants for the web frontend.
 *
 * Rule of thumb: only add values here if they are
 *   (a) used in 2+ files, OR
 *   (b) meaningful AI / business config the team may tune.
 */

// ── AI Request Timeouts ──────────────────────────────────────
export const AI_TIMEOUTS = {
  /** Long-running AI requests (essay review, prediction, recommendation, resume AI review) */
  AI_REQUEST: 120_000,
  /** SSE stream chunk idle timeout */
  SSE_CHUNK: 60_000,
  /** Default API request timeout */
  DEFAULT_REQUEST: 15_000,
} as const;

// ── React Query Cache Times ─────────────────────────────────
// Sourced from the shared QUERY_CACHE_TIERS (single source of truth for web +
// mobile staleTime). These named aliases preserve the readable web call sites.
import { QUERY_CACHE_TIERS } from '@study-abroad/shared';

export const STALE_TIME = {
  /** Infinity — immutable for a session (enums, country filters, ranking-list options). */
  IMMUTABLE: QUERY_CACHE_TIERS.static.staleTime,
  /** 30 min — rarely changing data (school details, rankings) */
  STATIC: QUERY_CACHE_TIERS.reference.staleTime,
  /** 5 min — moderate freshness (lists, profile, AI analysis) */
  MODERATE: QUERY_CACHE_TIERS.standard.staleTime,
  /** 1 min — dynamic data (forum, notifications) */
  DYNAMIC: QUERY_CACHE_TIERS.fresh.staleTime,
  /** 0 — always refetch (chat messages) */
  REALTIME: QUERY_CACHE_TIERS.realtime.staleTime,
} as const;

export const GC_TIME = {
  /** 10 min — AI analysis results worth keeping longer */
  AI_ANALYSIS: QUERY_CACHE_TIERS.standard.gcTime,
  /** 30 min — school recommendation cache */
  SCHOOL_RECOMMENDATION: QUERY_CACHE_TIERS.reference.gcTime,
  /** 5 min — default garbage collection */
  DEFAULT: QUERY_CACHE_TIERS.realtime.gcTime,
} as const;

// ── AI Point Costs ──────────────────────────────────────────
export const AI_POINT_COSTS = {
  ESSAY_REVIEW: 30,
  ESSAY_POLISH: 20,
  ESSAY_BRAINSTORM: 15,
} as const;

// ── UI Timers ───────────────────────────────────────────────
export const UI_TIMERS = {
  /** "Copied!" feedback duration */
  COPY_FEEDBACK: 2_000,
  /** Debounce delay for search inputs */
  SEARCH_DEBOUNCE: 300,
} as const;
