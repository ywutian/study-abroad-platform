# ADR 0011: Optional Injection Policy

**Status**: Accepted
**Date**: 2026-03-27
**Context**: `@Optional()` decorator was used on security-critical services, allowing silent degradation

## Decision

Three-tier `@Optional()` policy for the AI Agent module:

### Tier 1: Never Optional (error-level enforcement)

Security-critical services that protect user data and system integrity:

- `PromptGuardService` — input injection detection
- `ContentModerationService` — harmful content filtering
- `AuditService` — security event logging

These must be mandatory injections. `ArchitectureValidatorService` throws on startup in production/staging if any are missing.

### Tier 2: Conditionally Optional (info-level tracking)

Services where graceful degradation is acceptable:

- `ConfigValidatorService` — falls back to static `AGENT_CONFIGS` in dev/test
- `MemoryManagerService` — falls back to basic `MemoryService`
- `FastRouterService` — falls back to standard routing
- `FallbackService` — falls back to default error responses
- `ResilienceService` — provided globally, but `@Optional` allowed for resilience services themselves

### Tier 3: Infrastructure Optional

Services provided by `@Global()` modules where availability depends on infrastructure:

- `RedisService` — graceful degradation when Redis is not configured

### Testing

In unit tests, `@Optional` services may be mocked or omitted. The governance rules (G1) scan production code only (spec files excluded).

## Consequences

- G1 governance rule enforces Tier 1 automatically
- `ArchitectureValidatorService` logs a structured audit of all `@Optional` usages on startup
- New security services must be added to the `SECURITY_SERVICES` whitelist in G1
