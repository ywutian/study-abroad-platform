/**
 * Centralized constants for the web frontend.
 *
 * Rule of thumb: only add values here if they are
 *   (a) used in 2+ files, OR
 *   (b) meaningful AI / business config the team may tune.
 */

// ── AI Request Timeouts ──────────────────────────────────────
export const AI_TIMEOUTS = {
  /** Long-running AI requests (essay review, prediction, recommendation) */
  AI_REQUEST: 60_000,
  /** SSE stream chunk idle timeout */
  SSE_CHUNK: 60_000,
  /** Default API request timeout */
  DEFAULT_REQUEST: 15_000,
} as const;

// ── React Query Cache Times ─────────────────────────────────
export const STALE_TIME = {
  /** 30 min — rarely changing data (school details, rankings) */
  STATIC: 30 * 60 * 1000,
  /** 5 min — moderate freshness (lists, profile, AI analysis) */
  MODERATE: 5 * 60 * 1000,
  /** 1 min — dynamic data (forum, notifications) */
  DYNAMIC: 60 * 1000,
  /** 0 — always refetch (chat messages) */
  REALTIME: 0,
} as const;

export const GC_TIME = {
  /** 10 min — AI analysis results worth keeping longer */
  AI_ANALYSIS: 10 * 60 * 1000,
  /** 30 min — school recommendation cache */
  SCHOOL_RECOMMENDATION: 30 * 60 * 1000,
  /** 5 min — default garbage collection */
  DEFAULT: 5 * 60 * 1000,
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
