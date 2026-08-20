import { z } from 'zod';
import { Logger } from '@nestjs/common';

/**
 * Zod schema for environment variable validation.
 * Validates types, formats, and provides sensible defaults.
 */
const envSchema = z.object({
  // --- Core ---
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4101),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).optional(),

  // --- Database (Required) ---
  DATABASE_URL: z
    .string()
    .url()
    .startsWith(
      'postgresql://',
      'DATABASE_URL must be a PostgreSQL connection string',
    ),

  // --- JWT (Required) ---
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // --- Redis (Optional — graceful degradation) ---
  REDIS_URL: z.string().url().optional(),
  REDIS_URLS: z.string().optional(),
  REDIS_CACHE_URLS: z.string().optional(),
  REDIS_STATE_URLS: z.string().optional(),
  // 2026-05: REDIS_HOST used to default to 'localhost', which made
  // RedisService always try to connect even when no Redis was configured —
  // production logs filled with "connection refused" because the
  // `if (!redisHost) return [];` short-circuit was unreachable. Now both
  // host and port are fully optional; in-memory fallback engages when
  // neither URL nor HOST are set.
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().optional(),
  REDIS_PASSWORD: z.string().optional(),
  // Client-side deadline, so it also covers time the container spent without
  // CPU. Production runs on Cloud Run with `--cpu-throttling` and
  // `min-instances=0`, where an idle instance's event loop is starved until a
  // request or timer wakes it — 1000ms there tripped the circuit breaker 60-85
  // times a day for a month. The default stays 1000 (right for a local Redis);
  // production sets it explicitly in the deploy.
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),
  /** TCP keepalive probe delay. 0 restores ioredis's default (probes off). */
  REDIS_KEEPALIVE_MS: z.coerce.number().int().nonnegative().default(30000),
  REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600000),
  REDIS_TRANSIENT_CIRCUIT_COOLDOWN_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  REDIS_RECONNECT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),
  REDIS_HEALTH_PING_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().int().min(0).default(1),
  REDIS_ENABLE_OFFLINE_QUEUE: z.enum(['true', 'false']).default('false'),

  // --- Scheduler governance ---
  // Kill switch: gates @Cron registration itself (schedule-driver.ts) AND the
  // HTTP dispatcher, so 'false' really does stop every scheduled job.
  SCHEDULERS_ENABLED: z.enum(['true', 'false']).default('true'),
  // 'timer' (default): @Cron fires in-process — right for dev/tests/docker.
  // 'http' (production): NO in-process timers; Cloud Scheduler drives
  // POST /internal/cron/:name/run. @Cron timers on a CPU-throttled
  // min-instances=0 Cloud Run service starve and trip Redis's circuit breaker
  // (#553) — CPU is only guaranteed during a request, so schedules must
  // arrive AS requests. See common/cron/schedule-driver.ts.
  CRON_DRIVER: z.enum(['timer', 'http']).default('timer'),
  // Shared secret for /internal/cron (x-cron-secret header). Fail-closed:
  // absent → the endpoint answers 401 to everything.
  CRON_SECRET: z
    .string()
    .min(32, 'CRON_SECRET must be at least 32 characters')
    .optional(),
  // OPT-IN (default off): the application-analysis experiment/governance
  // automation evaluates analyses against admission OUTCOMES we do not yet
  // collect. Running it on absent data only yields empty no-op promotions and
  // log noise, so it stays dormant until that data pipeline exists. Set to
  // 'true' (with SCHEDULERS_ENABLED not 'false') to re-enable.
  APPLICATION_ANALYSIS_AUTOMATION_ENABLED: z
    .enum(['true', 'false'])
    .default('false'),

  // --- CORS ---
  CORS_ORIGINS: z.string().optional(),

  // --- Email (Optional — Resend primary, SMTP legacy compatibility) ---
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // --- Frontend URL (for email links) ---
  FRONTEND_URL: z.string().url().optional(),

  // --- AI / LLM (Optional) ---
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.4-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_PROVIDER: z.literal('openai').default('openai'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AI_AGENT_HARNESS_V1: z.enum(['true', 'false']).default('false'),
  AI_AGENT_HARNESS_MODE: z.enum(['advisory', 'action']).default('advisory'),
  AI_AGENT_APPROVALS_V1: z.enum(['true', 'false']).default('false'),
  AI_AGENT_APPROVAL_TTL_MS: z.coerce.number().int().min(60000).default(900000),
  AI_AGENT_RUN_TTL_MS: z.coerce.number().int().min(60000).default(86400000),
  AI_AGENT_EXECUTION_LEASE_MS: z.coerce
    .number()
    .int()
    .min(30000)
    .default(120000),

  // --- Search Engines (Optional) ---
  GOOGLE_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),

  // --- Memory & Cache ---
  MEMORY_CACHE_TTL: z.coerce.number().int().positive().default(86400),

  // --- Observability ---
  APP_NAME: z.string().default('api'),
  METRICS_ENABLED: z.enum(['true', 'false']).default('true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('study-abroad-api'),

  // --- College Scorecard (Optional) ---
  COLLEGE_SCORECARD_API_KEY: z.string().optional(),

  // --- Logo.dev (Optional — for auto-filling school logos by domain) ---
  LOGO_DEV_TOKEN: z.string().optional(),

  // --- Storage (Optional) ---
  STORAGE_TYPE: z.enum(['local', 's3', 'oss', 'cos']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),

  // --- Vault Encryption [A5-005 + A5-019] ---
  VAULT_ENCRYPTION_KEY: z
    .string()
    .min(32, 'VAULT_ENCRYPTION_KEY must be at least 32 characters')
    .optional(),

  // --- Sentry (Optional — recommended in production) ---
  SENTRY_DSN: z.string().url().optional(),

  // --- Rate Limiting [A5-017] ---
  // THROTTLE_TTL is in SECONDS (not ms). The app.module multiplies by 1000.
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // --- Webhook Signature [A5-020] ---
  WEBHOOK_SECRET: z.string().min(32).optional(),

  // --- Payments (retired by default) ---
  // The only provider currently present is a non-production simulator. Keeping
  // both switches explicit prevents an environment typo from enabling writes.
  PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false'),
  PAYMENT_PROVIDER: z.enum(['none', 'simulator']).default('none'),

  // --- Account purge (the job behind the deletion promise) ---
  // Ships DISABLED on purpose. `DELETE /users/me` has always been a soft delete
  // and the backlog of already-soft-deleted accounts is purged on the first
  // enabled run — irreversibly, in bulk. Left false, the job still runs and
  // logs exactly what it would remove, so the blast radius is a log line rather
  // than a guess. Turn it on once that number looks right, and only then may UI
  // copy state a retention period again.
  ACCOUNT_PURGE_ENABLED: z.enum(['true', 'false']).default('false'),
  // Grace window between the deletion request and the purge. 30 days is what
  // the old (unhonoured) copy promised and the usual recovery window.
  ACCOUNT_PURGE_GRACE_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  // --- Email Verification ---
  SKIP_EMAIL_VERIFICATION: z.enum(['true', 'false']).default('false'),

  // --- Request Timeouts (ms) ---
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AUTH_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),

  // --- Prediction Distillation ---
  DISTILLATION_BLEND_WEIGHT: z.coerce.number().min(0).max(1).default(0.2),
  DISTILLATION_TEACHER_WEIGHT_COLLEGEVINE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.6),
  DISTILLATION_TEACHER_WEIGHT_CAMPUSREEL_STATIC: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.3),
  COMPLIANT_DISTILLATION_WEIGHT_SCORECARD_V1: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.12),
  COMPLIANT_DISTILLATION_WEIGHT_IPEDS_TREND_V1: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.03),
  COMPLIANT_DISTILLATION_WEIGHT_CN_CASE_V1: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.12),
  COMPLIANT_DISTILLATION_WEIGHT_CN_OUTCOME_V1: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.08),

  // --- Prisma ---
  PRISMA_SLOW_QUERY_MS: z.coerce.number().int().positive().default(200),

  // --- Build metadata ---
  GIT_COMMIT_SHA: z.string().optional(),
  BUILD_TIME: z.string().optional(),
});

/**
 * Inferred type of validated environment variables.
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables at application startup using Zod schema.
 * Throws a descriptive error listing all validation failures.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const logger = new Logger('EnvValidation');

  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );

    const errorMessage = [
      '',
      '╔══════════════════════════════════════════════════════════╗',
      '║         ENVIRONMENT VARIABLE VALIDATION FAILED          ║',
      '╠══════════════════════════════════════════════════════════╣',
      ...errors.map((e) => `║ ${e.padEnd(56)} ║`),
      '╠══════════════════════════════════════════════════════════╣',
      '║  Check your .env file or environment configuration.     ║',
      '║  See .env.example for required variables.            ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Production checks — errors for security-critical, warnings for recommended
  if (result.data.NODE_ENV === 'production') {
    if (
      result.data.PAYMENTS_ENABLED !== 'false' ||
      result.data.PAYMENT_PROVIDER !== 'none'
    ) {
      throw new Error(
        'FATAL: paid subscriptions are retired. Production requires ' +
          'PAYMENTS_ENABLED=false and PAYMENT_PROVIDER=none.',
      );
    }

    // The whole point of CRON_DRIVER=http is that jobs still RUN — via Cloud
    // Scheduler. Without a secret the dispatcher is fail-closed 401, which in
    // production means every scheduled job is silently off (staging does this
    // deliberately; prod must not).
    if (result.data.CRON_DRIVER === 'http' && !result.data.CRON_SECRET) {
      throw new Error(
        'FATAL: CRON_SECRET must be set when CRON_DRIVER=http in production ' +
          '(otherwise every scheduled job is silently disabled). ' +
          'Generate with: openssl rand -hex 32',
      );
    }

    // Security-critical: MUST be set in production [A5-005]
    if (!result.data.VAULT_ENCRYPTION_KEY) {
      throw new Error(
        'FATAL: VAULT_ENCRYPTION_KEY must be set in production. ' +
          'Generate with: openssl rand -hex 32',
      );
    }
    // CORS check is also enforced in main.ts bootstrap [A5-004]
    if (!result.data.CORS_ORIGINS) {
      throw new Error(
        'FATAL: CORS_ORIGINS must be set in production. ' +
          'Example: CORS_ORIGINS=https://app.example.com',
      );
    }

    if (!result.data.FRONTEND_URL) {
      throw new Error(
        'FATAL: FRONTEND_URL must be set in production for email links. ' +
          'Example: FRONTEND_URL=https://app.example.com',
      );
    }

    // Recommended but non-fatal
    if (!result.data.OPENAI_API_KEY) {
      logger.warn(
        'OPENAI_API_KEY is not set — AI chat, essay review, and recommendation features disabled',
      );
    }
    if (!result.data.SENTRY_DSN) {
      logger.warn(
        'SENTRY_DSN is not set — error tracking disabled in production',
      );
    }
    if (
      !result.data.REDIS_URL &&
      !result.data.REDIS_URLS &&
      !result.data.REDIS_CACHE_URLS &&
      !result.data.REDIS_STATE_URLS
    ) {
      logger.warn(
        'REDIS_URL is not set — caching and rate limiting will use in-memory fallback',
      );
    }
  }

  return result.data;
}
