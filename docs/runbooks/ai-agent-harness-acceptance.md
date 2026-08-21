# AI Agent Harness production acceptance

Use this runbook after a Harness release reaches the no-traffic validation
revision and again after the explicitly validated revision is promoted directly
to 100%. Use a dedicated synthetic account and synthetic content only. Never put
access tokens, raw prompts, tool results, application materials, or memory text
in the evidence record.

## Preconditions

- Record the Git commit, Cloud Run revision, feature-flag values, and test-account ID hash.
- Confirm the previous production revision is still available as the rollback target.
- Confirm `/health` reports `status=ok`, `database=ok`, and `redis=ok`.
- Confirm the live Cron Registry matches `.github/cron-jobs.json`.
- Confirm `AI_AGENT_ACCEPTANCE_V1=true`. This enables only admin-issued,
  user-scoped failure grants; it does not expose a public fault-injection API.

## Automated production runner

Run the five scenarios with a disposable synthetic account. Credentials are
read from the environment and are never written to the evidence output:

```bash
HARNESS_API_BASE=https://<cloud-run-url>/api/v1 \
HARNESS_ADMIN_EMAIL=<admin-email> \
HARNESS_ADMIN_PASSWORD=<admin-password> \
HARNESS_EXPECTED_REVISION=<revision> \
pnpm harness:acceptance --production
```

The runner refuses to start without `--production`, emits only the allowlisted
evidence fields below, and clears the synthetic event, Agent data, and account
in a `finally` path. Any failed cleanup fails the acceptance run.

Acceptance grants are one-shot Redis records with a five-minute TTL. Context
failure grants affect only the target synthetic user's next eligible
compression. Budget grants can only reduce the frozen per-run budget.

## Required scenarios

| Scenario             | Action                                                                                             | Required evidence                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Memory disabled      | Set `enableMemory=false`, send a synthetic request, then inspect service calls and persisted state | No extraction, recall, entity lookup, or memory prompt injection; conversation and Run persistence remain available   |
| Context compression  | Submit enough synthetic messages to cross the summarization threshold                              | Latest valid structured summary remains, recent messages remain, tool payload is represented only by a reference      |
| Compression fallback | Force the summarizer fixture to fail                                                               | Previous valid summary is unchanged; `AI_AGENT_CONTEXT_COMPRESSION_FALLBACK` warning and aggregated alert are emitted |
| Approval recovery    | Request a confirmation-required synthetic write, approve it, disconnect, and resume                | One approval fingerprint, one side effect at most, terminal Run state, reconnect returns the same result              |
| Budget exhaustion    | Use the bounded test configuration to exceed token and duration limits                             | Deterministic terminal failure, no extra tool side effect, corresponding Harness metric increments                    |

## Evidence record

Store only the following fields in the release report:

- UTC timestamp, Git commit, Cloud Run revision, and scenario name.
- HTTP status and final `AgentRunStatus`.
- Approval status and a one-way fingerprint when applicable.
- Counter names and before/after numeric values.
- Pass/fail plus a stable reason code.

Do not store request/response bodies, tool arguments/results, credentials,
conversation summaries, personal data, or memory content.

## Automated coverage mapping

- Memory boundary: `memory-manager.service.spec.ts`
- Compression and last-valid-summary fallback: `conversation-context.service.spec.ts`
- Approval idempotency and recovery: `agent-run.service.spec.ts`
- Budget enforcement: `agent-run-context.spec.ts` and `llm.service.spec.ts`
- Acceptance grants and durable evidence: `agent-harness-operations.service.spec.ts`
- Completed reconnect and terminal-state races: `orchestrator.service.spec.ts`
  and `agent-run.service.spec.ts`
- Trace redaction and write-failure alerting: `agent-evaluation-trace.service.spec.ts`

The release owner signs off only after all five scenarios pass on the intended
revision. Any approval duplication, privacy exposure, missing terminal state, or
unbounded execution is a hard failure and requires rollback.
