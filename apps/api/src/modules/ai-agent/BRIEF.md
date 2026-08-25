# Module: ai-agent

**Last updated:** 2026-08-24

## Purpose

OpenAI-compatible multi-Agent orchestration with SSE/WebSocket chat, a bounded
ReWOO Harness, policy-governed tools, durable approvals and Run recovery,
context compression, memory, declarative Skill versions, and sanitized
evaluation evidence.

## Key Files

- `ai-agent.controller.ts` / `ai-agent.gateway.ts` — SSE and WebSocket entry points
- `core/orchestrator.service.ts` — routing, persistence, pause/resume, and terminal results
- `core/agent-runner.service.ts` — resolves and pins the Agent Skill used by a Run
- `core/workflow-engine.service.ts` — Plan → Execute → supplemental observation/planning → Solve
- `core/tool-policy.service.ts` — centralized `allow | deny | confirmation_required` decisions
- `core/agent-run.service.ts` — durable Run, approval, lease, checkpoint, and idempotency state
- `core/agent-harness-operations.service.ts` — synthetic acceptance grants and sanitized evidence
- `core/agent-evaluation-trace.service.ts` — redacted evaluation trace persistence
- `memory/conversation-context.service.ts` — structured compression and last-valid-summary fallback
- `skills/` — immutable declarative Skill versions, evaluation, publishing, and rollback
- `benchmark/` — deterministic legacy-versus-Harness gate: 120 synthetic
  fixtures × 3 repetitions, six categories, 6 Agents, 2 locales, and 45/45 Tools
- `config/agents.config.ts` / `config/tools.config.ts` — 6 Agent configs and 45/45 tool metadata entries

## Data Model

- Conversation continuity: `Conversation`, `Message`, `ConversationSummary`
- Long-term context: `Memory` with pgvector and lifecycle metadata
- Execution: `AgentRun`, `AgentApproval`, `AgentEvaluationTrace`
- Declarative Skills: `AgentConfigVersion`, `AgentSkillEvaluation`,
  `AgentSkillDeployment`, and `AgentSkillAudit`
- Usage and audit: token usage, security events, and opaque Harness evidence

## Business Rules

- `@ThrottleAI()` and `AgentThrottleGuard` protect natural-language entry points.
- `AI_AGENT_HARNESS_V1=false` preserves the legacy path; enabled Runs have a
  maximum of two supplemental planning rounds and 16 executed tool calls.
- Tool metadata is exhaustive. Unknown tools, missing metadata, or policy
  failures deny by default.
- Advisory mode allows only `read` and `generate`; protected writes require an
  action-mode approval bound to Run, user, tool, normalized arguments, and TTL.
- A successful tool fingerprint executes at most once per Run, including after
  approval, reconnect, retry, or service restart.
- Each Run freezes its budget and `skillVersionId` at creation. Publishing or
  rollback affects only subsequently created Runs.
- Context checkpoints, conversation summaries, long-term memory, and
  evaluation traces are separate stores with separate privacy rules.
- `enableMemory=false` disables extraction, recall, lookup, and prompt
  injection, but not Conversation or Run persistence.
- Skills may narrow tools and change declarative guidance only; they cannot add
  executable code, credentials, tools, budgets, providers, or policy rules.
- All NL endpoints must be registered in `nl-endpoints.json` and the security
  middleware route list.

## Feature Flags

```text
AI_AGENT_HARNESS_V1
  ├─ AI_AGENT_APPROVALS_V1
  ├─ AI_AGENT_CONTEXT_V1
  └─ AI_AGENT_ACCEPTANCE_V1 (admin-issued synthetic grants only)

AI_AGENT_SKILLS_V1
  └─ AI_AGENT_SKILLS_EVOLUTION_V1
       └─ AI_AGENT_SKILLS_AUTO_PUBLISH_V1
```

Every flag defaults off locally. Production values are explicit in the deploy
workflow and checked for documentation drift.

## Deep Dive

- Architecture: `docs/architecture/ai-system.md`
- Memory boundaries: `docs/AI_AGENT_MEMORY_SYSTEM_SPEC.md`
- Declarative Skills: `docs/AI_AGENT_SKILLS_EVOLUTION.md`
- Production acceptance: `docs/runbooks/ai-agent-harness-acceptance.md`
- Deploy invariants: `docs/DEPLOY_CONFIG.md`

## Gotchas

- `LLMProvidersModule.forRoot()` is global; do not create a second LLM stack or
  add an unimplemented provider value.
- Nest child modules cannot inject providers registered only by a parent.
  Required Harness dependencies must be exported by the module that owns them;
  do not hide missing critical wiring behind `@Optional()`.
- Structured summary parsing can return an invalid object without throwing.
  Preserve the last valid summary and use the deterministic safe fallback.
- Acceptance JSONL must be emitted by the direct Node/tsx entry point; package
  manager lifecycle output must not contaminate the evidence stream.
- `_components/` under the AI operations admin area is shared; do not delete it.
- Publishing a Skill requires a passing evaluation against the current active
  version and atomically preserves the previous version for rollback.
