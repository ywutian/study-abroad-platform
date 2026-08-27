# AI Agent Harness production acceptance

**Last updated:** 2026-08-24

## Contents

- [Preconditions](#preconditions)
- [Release sequence](#release-sequence)
- [Automated runner](#automated-runner)
- [Required records](#required-records)
- [Evidence allowlist](#evidence-allowlist)
- [Alert closure](#alert-closure)
- [Automated coverage mapping](#automated-coverage-mapping)
- [Sign-off and rollback](#sign-off-and-rollback)

Use this runbook after a Harness release reaches its no-traffic validation
revision and again after that exact revision is promoted directly to 100%.
There is no 5%/25% user-traffic stage for the Harness. Use only a disposable
synthetic account and synthetic content.

## Preconditions

- Record the Git commit, intended Cloud Run revision, active feature flags, and
  previous stable revision.
- Confirm `/health` reports API, database, and Redis `ok`.
- Confirm the live Cron Registry matches `.github/cron-jobs.json`, uses
  `driver=http`, registers zero in-process timers, and rejects unauthenticated
  dispatch requests.
- Confirm `AI_AGENT_ACCEPTANCE_V1=true`. It enables only admin-issued,
  user-scoped, one-shot failure grants; it is not a public fault-injection API.
- Confirm the protected administrator secret is available to the runner. Never
  print it or store it in an artifact.
- Confirm the previous stable revision remains addressable before changing
  production traffic.

## Release sequence

```text
build and migrate
  → deploy revision with --no-traffic
  → health and Cron checks against tagged revision
  → full synthetic Harness acceptance and strict evidence validation on tagged revision
  → direct atomic traffic switch to 100%
  → stable-URL health and Cron checks
  → production Harness acceptance
  → sanitized artifact validation
  → alert monitor and rollback-target confirmation
```

Any failed post-promotion check triggers the workflow rollback path. Scheduler
topology is synchronized only after the live registry is proven, and stale jobs
are pruned after the new service is accepted.

An isolated-revision acceptance failure blocks promotion. The pre-promotion runner
uses the same protected administrator secret and a fresh disposable synthetic
account, and uploads a separate sanitized `ai-agent-harness-pre-promote-<commit>`
artifact. It does not replace the required post-promotion run against the stable URL.

## Automated runner

For a manual authorized run:

```bash
HARNESS_API_BASE=https://<cloud-run-url>/api/v1 \
HARNESS_ADMIN_EMAIL=<admin-email> \
HARNESS_ADMIN_PASSWORD=<admin-password> \
HARNESS_EXPECTED_REVISION=<revision> \
pnpm harness:acceptance --production
```

The runner refuses to start without `--production`. In CI it must be invoked
through the direct Node/tsx entry point so package-manager lifecycle banners
cannot corrupt its JSONL evidence stream:

```bash
node --import tsx apps/api/scripts/ai-agent-harness-acceptance.ts --production
```

Credentials come from the environment and never enter evidence. The runner
clears the synthetic event, Agent data, and account in a `finally` path. Any
cleanup failure fails the entire acceptance run.

Acceptance grants are one-shot Redis records with a five-minute TTL. Context
failure affects only the target synthetic user's next eligible compression.
Budget grants can only reduce the frozen per-Run budget.

## Required records

| Record                         | Required evidence                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `declarative_skills_boundary`  | Six active deployments, auto-publish status, safe candidate accepted, permission expansion rejected, historical public credential rejected |
| `setup`                        | Synthetic account created; evidence contains only its one-way hash                                                                         |
| `skill_version_pinning`        | New Run persists the active version; later deployment changes cannot alter that Run                                                        |
| `memory_disabled`              | No extraction, recall, entity lookup, or memory prompt injection; Conversation and Run persistence still work                              |
| `context_compression`          | Valid structured summary persists, recent messages remain, and tool payload is represented only by reference                               |
| `context_compression_fallback` | Previous valid summary hash is unchanged; fallback metric and durable opaque alert are emitted                                             |
| `approval_disconnect_recovery` | Approval fingerprint is stable; reconnect/resume returns the terminal result; side effect occurs at most once                              |
| `budget_exhaustion`            | Run reaches deterministic terminal failure with no extra side effect and the budget metric increments                                      |
| `cleanup`                      | Synthetic event deleted, AI data cleared, and account soft-deleted                                                                         |

The top-level record must have `pass=true` and an empty `reasonCodes` array.
`scripts/ci/validate-harness-acceptance-evidence.mjs` is the machine-readable
contract. Never treat a successful process exit as sufficient without validating
the artifact.

## Evidence allowlist

Store only:

- Schema version, UTC timestamp, Git commit, Cloud Run revision, and scenario.
- HTTP status and final `AgentRunStatus`.
- Approval status and a one-way fingerprint where applicable.
- Counter names and before/after numeric values.
- One-way summary/account hashes, never their source content.
- Pass/fail and stable reason code.
- Cleanup booleans.

Never store request/response bodies, prompts, tool arguments/results,
credentials, conversation summaries, application materials, memory content,
access tokens, or raw user identifiers.

## Alert closure

The synthetic compression-fallback alert must be persisted and then
acknowledged by the runner after its evidence is captured. Do not automatically
acknowledge any unrelated production alert. Run the independent
`AI Agent Harness alert monitor` workflow and require:

```json
{ "activeAlerts": 0, "bySeverity": { "critical": 0, "warning": 0, "info": 0, "unknown": 0 } }
```

If a real alert exists, retain it, inspect only sanitized aggregates, and stop
promotion or roll back according to impact.

## Automated coverage mapping

- Memory boundary: `memory-manager.service.spec.ts`
- Compression and last-valid-summary fallback:
  `conversation-context.service.spec.ts`, `summarizer.service.spec.ts`
- Approval idempotency and recovery: `agent-run.service.spec.ts`
- Budget enforcement: `agent-run-context.spec.ts`, `llm.service.spec.ts`
- Acceptance grants and durable evidence:
  `agent-harness-operations.service.spec.ts`
- Completed reconnect and terminal races: `orchestrator.service.spec.ts`,
  `agent-run.service.spec.ts`
- Trace redaction and write-failure alerting:
  `agent-evaluation-trace.service.spec.ts`
- Skill policy, evaluation, pinning, publish, and rollback: `skills/*.spec.ts`
- Evidence-schema and command integrity:
  `scripts/ci/validate-harness-acceptance-evidence.test.mjs`,
  `scripts/ci/harness-acceptance-command.test.mjs`

## Sign-off and rollback

The release is closed only when every required record passes on the intended
revision, cleanup passes, the sanitized artifact validates, the independent
alert monitor reports zero active alerts, and the rollback revision is still
available. Any approval duplication, privacy exposure, permission expansion,
missing terminal state, unbounded execution, evidence contamination, or cleanup
failure is a hard failure and requires rollback.
