/**
 * Redis TTL single source of truth (values in SECONDS).
 *
 * Before this file, cache TTLs were scattered across 20+ services as bare magic
 * numbers — impossible to audit or tune in one place when Upstash quota got
 * tight. Every Redis write TTL now references a named entry here, grouped by
 * tier, and the `no-hardcoded-redis-ttl` lint rule keeps it that way.
 *
 * Pick the entry by meaning, not by duration: two caches that happen to both be
 * "1h" today may diverge tomorrow, and a named constant makes the intent obvious.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const REDIS_TTL = {
  // ── 90 days ───────────────────────────────────────────────
  /** Push notification device tokens. */
  PUSH_TOKEN: 90 * DAY,

  // ── 35 days ───────────────────────────────────────────────
  /** Monthly LLM token/cost rollup (token-tracker). */
  MONTHLY_TOKEN_STATS: 35 * DAY,
  /** Daily security-event metrics rollup retained for monthly views (audit). */
  SECURITY_DAILY_METRICS: 35 * DAY,

  // ── 30 days ───────────────────────────────────────────────
  /** Notification history list. */
  NOTIFICATION: 30 * DAY,
  /** Archived alert payloads (alert-channel). */
  ALERT_ARCHIVE: 30 * DAY,

  // ── 7 days ────────────────────────────────────────────────
  /** Live alert payloads (alert-channel). */
  ALERT_DATA: 7 * DAY,

  // ── 3 days ────────────────────────────────────────────────
  /** Per-(user, prediction) decision-day reminder re-send cadence (dedup). */
  OUTCOME_REMINDER_DEDUP: 3 * DAY,

  // ── 2 days ────────────────────────────────────────────────
  /** Daily LLM token/cost rollup (token-tracker). */
  DAILY_TOKEN_STATS: 2 * DAY,
  /** Hourly security-event metrics rollup (audit). */
  SECURITY_HOURLY_METRICS: 2 * DAY,

  // ── 24 hours ──────────────────────────────────────────────
  /** Admission prediction results. */
  PREDICTION_RESULT: 1 * DAY,
  /** Prediction historical / calibration distribution snapshots. */
  PREDICTION_DISTRIBUTION: 1 * DAY,
  /** Static school metrics (rarely change). */
  SCHOOL_METRICS: 1 * DAY,
  /** Cached school id sets (e.g. UC ids). */
  SCHOOL_IDS: 1 * DAY,
  /** AI short-term memory (conversation / user context) default. */
  MEMORY_CACHE: 1 * DAY,
  /** Embedding vector cache. */
  EMBEDDING_CACHE: 1 * DAY,
  /** School recommendation result cache. */
  RECOMMENDATION_CACHE: 1 * DAY,
  /** Per-user-per-day deadline-reminder dedup. */
  DEADLINE_DEDUP: 1 * DAY,

  // ── 2 hours ───────────────────────────────────────────────
  /** School recommendation result cache (school controller). */
  SCHOOL_REC_RESULT: 2 * HOUR,

  // ── 1 hour ────────────────────────────────────────────────
  /** Individual school detail. */
  SCHOOL_DETAIL: 1 * HOUR,
  /** School list query results. */
  SCHOOL_LIST: 1 * HOUR,
  /** Per-school calibration params (more volatile than distributions). */
  SCHOOL_CALIBRATION: 1 * HOUR,
  /** Application-analysis results (v1 + v2). */
  ANALYSIS_CACHE: 1 * HOUR,
  /** Generic school report cache. */
  SCHOOL_REPORT: 1 * HOUR,
  /** Prompt-injection threat history per user. */
  THREAT_HISTORY: 1 * HOUR,

  // ── 10 minutes ────────────────────────────────────────────
  /** Memory compaction distributed lock. */
  COMPACTION_LOCK: 10 * MINUTE,
  /** Memory decay distributed lock. */
  DECAY_LOCK: 10 * MINUTE,
  /** Deadline-reminder cron single-flight lock (multi-instance safety). */
  DEADLINE_CRON_LOCK: 10 * MINUTE,
  /** Outcome decision-day reminder cron single-flight lock. */
  OUTCOME_REMINDER_CRON_LOCK: 10 * MINUTE,
  /** IPEDS update-monitor cron single-flight lock. */
  IPEDS_MONITOR_CRON_LOCK: 10 * MINUTE,
  /** Tentative-deadline refresh cron single-flight lock. */
  DEADLINE_REFRESH_CRON_LOCK: 10 * MINUTE,

  // ── 5 minutes ─────────────────────────────────────────────
  /** Permission resolution cache. */
  PERMISSION: 5 * MINUTE,
  /** Global settings cache. */
  SETTINGS: 5 * MINUTE,
  /** Circuit-breaker state (resilience). */
  CIRCUIT_BREAKER: 5 * MINUTE,
  /** Memory cleanup distributed lock. */
  CLEANUP_LOCK: 5 * MINUTE,
  /** User profile cache. */
  PROFILE: 5 * MINUTE,
  /** Generic short-lived result cache (school misc reads). */
  SHORT_RESULT: 5 * MINUTE,

  // ── 2 minutes ─────────────────────────────────────────────
  /** Prediction computation idempotency lock. */
  PREDICTION_LOCK: 2 * MINUTE,
  /** Recommendation generation lock. */
  RECOMMENDATION_LOCK: 2 * MINUTE,

  // ── 1 minute ──────────────────────────────────────────────
  /** Feature-flag evaluation cache. */
  FEATURE_FLAG: 1 * MINUTE,
  /** Per-conversation orchestration lock. */
  CONVERSATION_LOCK: 1 * MINUTE,
  /** In-process L1 school cache mirror. */
  LOCAL_CACHE: 1 * MINUTE,
} as const;

export type RedisTtlKey = keyof typeof REDIS_TTL;
