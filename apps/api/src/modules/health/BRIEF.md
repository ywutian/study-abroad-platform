# Module: health

## Purpose

Kubernetes-style health check endpoints: liveness, readiness, startup probes, and detailed status for admin monitoring.

## Key Files

- `health.controller.ts` — All health endpoints (/, /live, /ready, /startup, /detailed)
- `health.module.ts` — Module registration

## Data Model

No owned models. Reads runtime state: DB connectivity, Redis connectivity, memory usage, AI security status.

## Dependencies

PrismaService, RedisService (@Optional), ArchitectureValidatorService (@Optional) | AI/LLM: Check (reports AI security status)

## Business Rules

- `/health`, `/live`, `/ready`, `/startup` are `@Public()` + `@SkipThrottle()` (probe endpoints)
- `/health/detailed` requires `Role.ADMIN` (exposes env, build info, AI security)
- `/health/ready` returns 503 when `aiSecurity === 'degraded'` in production/staging
- Reports: DB latency, Redis latency, memory usage %, uptime, version

## Gotchas

- RedisService and ArchitectureValidatorService are both `@Optional()` — graceful degradation
- No service file — all logic is in the controller
- AI security status and embedding consistency are checked via ArchitectureValidatorService
