# ADR-0004: Zod-Based Environment Variable Validation

## Status

Accepted

## Date

2026-02-07

## Context

The application previously validated environment variables using a simple "presence check" — verifying that required variables like `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` existed, but not validating their types, formats, or providing defaults.

This led to:

- Runtime crashes from misconfigured variables (e.g., non-numeric `PORT`)
- Silent misconfiguration where variables were set but had invalid formats
- No feedback about recommended variables missing in production (e.g., `SENTRY_DSN`)

## Decision

Replace the basic presence-check `validateEnv` function with a **Zod schema** that validates types, formats, ranges, and defaults for all known environment variables.

Key aspects:

- **Type coercion**: `PORT`, `THROTTLE_TTL`, `THROTTLE_LIMIT` coerced to numbers
- **Format validation**: `DATABASE_URL` must start with `postgresql://`, `SENTRY_DSN` must be a URL
- **Security validation**: `JWT_SECRET` must be at least 16 characters
- **Defaults**: Sensible defaults for non-critical variables (`PORT=3001`, `OPENAI_MODEL=gpt-4o-mini`)
- **Production warnings**: Log warnings when recommended variables (`SENTRY_DSN`, `REDIS_URL`, `CORS_ORIGINS`) are missing in production

## Consequences

### Positive

- Application fails fast at startup with descriptive, formatted error messages
- Type safety for environment variable access throughout the codebase
- Production misconfigurations are surfaced as warnings before they cause runtime issues

### Negative

- Adding new environment variables requires updating the Zod schema
- Test environments must provide valid-format variables (not just any string)

### Risks

- The schema may be too strict for some deployment environments — use `.optional()` and `.default()` generously
