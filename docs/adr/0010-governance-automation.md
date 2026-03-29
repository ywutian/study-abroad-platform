# ADR 0010: Architecture Governance Automation

**Status**: Accepted
**Date**: 2026-03-27
**Context**: Enterprise audit identified 9 architecture gaps in the AI Agent module

## Decision

Implement a multi-layer governance system to prevent architecture regression:

### Layer 1: Static Analysis (`scripts/governance/`)

5 rules (G1-G5) enforced via CLI, integrated into `check-integration.ts` as the `governance` domain:

- **G1 optional-security** (error): No `@Optional()` on security-critical services (PromptGuard, ContentModeration, Audit)
- **G2 nl-endpoint-coverage** (error): All NL endpoints covered by `AgentSecurityMiddleware` / gateway guards
- **G3 config-consistency** (error): No direct `AGENT_CONFIGS[...]` reads outside validator (fallback `??` pattern allowed)
- **G4 user-data-isolation** (warning): Prisma queries should include `userId` filter
- **G5 dead-provider** (warning): Detect unused providers in `ai-agent.module.ts`

### Layer 2: Runtime Startup Validation (`ArchitectureValidatorService`)

- Security service resolvability via `ModuleRef.get()`
- ConfigValidator existence check
- Embedding model consistency audit
- Behavior by `NODE_ENV`: production/staging → throw on missing security; development/test → warn only

### Layer 3: Health Endpoint Integration

- `/health/detailed` includes `aiSecurity` status + `embeddingConsistency`
- `/health/ready` returns 503 when `aiSecurity === 'degraded'` in production/staging

### Layer 4: Jest Architecture Tests (`architecture.spec.ts`)

- Single source of truth: calls governance CLI via `execSync`
- 3 error-level assertions (G1-G3) + health contract assertion

### Layer 5: CI Enforcement

- **Phase 1** (current): `governance` domain is a blocking CI step; other domains remain `continue-on-error: true`
- **Phase 2** (Batch 7): Remove `continue-on-error` from all integration checks

### NODE_ENV Staging Convention

The system uses `NODE_ENV` (not a separate `APP_ENV`). Valid values: `development`, `production`, `test`, `staging`.

- **Staging environments MUST set `NODE_ENV=staging`** (not `production`) to get warning-level validation
- If ops sets `NODE_ENV=production` on staging, the strict validation behavior is intentional — staging should match production strictness
- This convention is defined in `env.validation.ts` and must align with infrastructure configuration

## Consequences

- Every architecture gap has at least 2 layers of coverage
- New security services automatically detected by G1 if made `@Optional()`
- New NL endpoints must be added to `nl-endpoints.json` to pass G2
- Config consumers must use `ConfigValidatorService`, not direct `AGENT_CONFIGS` reads
