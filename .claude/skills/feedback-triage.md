---
name: feedback-triage
description: Process external feedback through the mandatory 5-stage pipeline (triage -> batch -> implement -> verify -> release)
---

# Feedback Triage Pipeline

Process external feedback following the project's mandatory 5-stage workflow. Never skip triage to jump straight to code.

## Arguments

The user provides feedback items (from users, testers, stakeholders, or issues).

## Stage 1: Triage (MANDATORY FIRST STEP)

For each feedback item, classify:

| Category | Description | Example |
|---|---|---|
| `CODE_BUG` | Something is broken | "Submit button doesn't work" |
| `DATA_ISSUE` | Wrong/missing data | "Harvard acceptance rate is wrong" |
| `UX_CONFUSION` | User can't figure out how | "I can't find where to add test scores" |
| `NEW_FEATURE` | Feature request | "Add essay word count" |
| `INDUSTRY_SUGGESTION` | Domain-specific improvement | "Tier classification should weight research output" |

For each item, also determine:
- **Severity**: `BLOCK` / `WARN` / `INFO` (unified, see `.claude/manifests/agent-workflow.yml` → `severity`)
  - `BLOCK` = feature broken, data corruption, security issue
  - `WARN` = usability degraded, workaround exists
  - `INFO` = polish, suggestion
- **Affected area**: backend / frontend / mobile / ai / database / shared
- **Root cause hypothesis**: One sentence on what's likely wrong

Output a triage table:

```
| # | Feedback | Category | Severity | Area | Root Cause |
|---|----------|----------|----------|------|------------|
```

## Stage 2: Batch Plan

Group triaged items into batches of **at most 3 items** per batch. For each batch:

1. Select relevant review agents — **read `.claude/manifests/agent-workflow.yml`** → `selection.by_change_type` for the affected area, plus `acceptance.by_feedback_type` for the feedback category
2. Define acceptance criteria for each item — must be **user-visible result**, not "code changed"
3. Identify shared dependencies between items in the batch

## Stage 3: Implement

For each batch:

1. Launch relevant agents for plan review (from manifest `selection`)
2. Implement changes
3. Run `npx tsx scripts/verify-gate.ts --staged` before staging
4. Run acceptance agents (from manifest `acceptance.mandatory`: Integration Checker + Test Engineer, plus `acceptance.by_feedback_type` for the specific category)

## Stage 4: Verify

For each item, verify against the acceptance criteria defined in Stage 2:
- The verification must demonstrate a **user-visible result**
- "Code changed" or "tests pass" alone is NOT sufficient
- Take a screenshot or describe the observable behavior change

## Stage 5: Release

1. Run pre-push gate: `pnpm prepush`
2. Document what was changed and why in commit message
3. Update feedback tracking if applicable
4. Mark each item as verified

## Rules

- NEVER skip Stage 1 — even "obvious" bugs need classification
- Batch size MUST be <= 3 (prevents scope creep)
- Acceptance criteria MUST be user-visible
- Agent selection per feedback category: see `.claude/manifests/agent-workflow.yml` → `acceptance.by_feedback_type`
- `DATA_ISSUE` items: also check `docs/DATA_SOURCES.md` for source of truth
