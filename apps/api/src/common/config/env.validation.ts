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
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

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

  // --- CORS ---
  CORS_ORIGINS: z.string().optional(),

  // --- Email (Optional) ---
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().int().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // --- OpenAI (Optional) ---
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // --- Storage (Optional) ---
  STORAGE_TYPE: z.enum(['local', 's3', 'oss', 'cos']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),

  // --- Sentry (Optional — recommended in production) ---
  SENTRY_DSN: z.string().url().optional(),

  // --- Rate Limiting ---
  THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

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

  // Production warnings for recommended but optional variables
  if (result.data.NODE_ENV === 'production') {
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
    if (!result.data.CORS_ORIGINS) {
      logger.warn(
        'CORS_ORIGINS is not set — CORS open to all origins in production (unsafe)',
      );
    }
  }

  return result.data as unknown as Record<string, unknown>;
}
