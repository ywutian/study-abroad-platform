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
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // --- CORS ---
  CORS_ORIGINS: z.string().optional(),

  // --- Email (Optional) ---
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // --- Frontend URL (for email links) ---
  FRONTEND_URL: z.string().url().optional(),

  // --- OpenAI (Optional) ---
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),

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

  // --- Request Timeouts (ms) ---
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AUTH_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),

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
      '║  See ENV_TEMPLATE.md for required variables.            ║',
      '╚══════════════════════════════════════════════════════════╝',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Production checks — errors for security-critical, warnings for recommended
  if (result.data.NODE_ENV === 'production') {
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
    if (!result.data.REDIS_URL) {
      logger.warn(
        'REDIS_URL is not set — caching and rate limiting will use in-memory fallback',
      );
    }
  }

  return result.data as unknown as Record<string, unknown>;
}
