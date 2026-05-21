---
name: workflow-receipt
description: Generate a structured audit receipt at the end of an agent workflow — records which agents ran, N/A exits, blocking findings, acceptance completion, and journey checks
---

# Workflow Receipt

Generate a structured audit trail for the just-completed agent workflow. Call this at the END of `/review` or `/feedback-triage`, or after any manual multi-agent workflow.

## When to Use

- After `/review` finishes (or as its final step)
- After `/feedback-triage` Stage 5 (Release)
- After any significant change where multiple agents were invoked
- When user asks "log this workflow" or "generate receipt"

## Step 1: Collect Workflow State

From the current conversation, identify:

1. **Change classification**
   - Branch name (`git branch --show-current`)
   - Categories affected (backend/frontend/mobile/ai/database/shared)
   - Change type (from `.claude/manifests/agent-workflow.yml` → `selection.by_change_type`)

2. **Agents invoked (Phase 1)**
   - Which agents were launched for plan review
   - For each: status (`DONE` / `N/A` / `SKIP`), count of BLOCK/WARN/INFO findings

3. **Acceptance (Phase 2)**
   - Integration Checker result
   - Test Engineer result
   - User Journey Auditor result (if user-visible)

4. **Journey verification** (if applicable)
   - Did any journey path check run?
   - Which journey IDs were validated?

## Step 2: Generate Receipt File

Write to `.claude/receipts/{YYYY-MM-DD}-{HHmm}-{branch-slug}.md`:

```markdown
# Workflow Receipt

**Date**: {ISO timestamp}
**Branch**: {branch name}
**Workflow**: {review | feedback-triage | manual}

## Change Classification

- **Categories**: {list, e.g., frontend, shared}
- **Change type**: {from manifest, e.g., full_stack}
- **Files changed**: {count} files

## Phase 1: Plan Review

| Agent | Status | Findings |
|-------|--------|----------|
| Architect | DONE | 0 BLOCK, 1 WARN, 0 INFO |
| Design Reviewer | DONE | 0 BLOCK, 2 WARN, 3 INFO |
| i18n Specialist | DONE | 0 issues |
| Security Reviewer | N/A | "No auth/guard changes" |
| Test Engineer | DONE | 0 BLOCK, 1 WARN, 0 INFO |

## Phase 2: Acceptance

| Agent | Status | Result |
|-------|--------|--------|
| Integration Checker | DONE | 0 issues (types aligned, permissions OK) |
| Test Engineer | DONE | 194 suites / 2777 tests pass |
| User Journey Auditor | SKIP | "Not user-visible" |

## Journey Verification

- Ran `lint:journeys`: ✅ (or ❌)
- Journeys validated: {list, e.g., A3, A10}

## Summary (structured)

```yaml
agents_run: 5
n_a_agents: 1
blocking_findings: 0
warning_findings: 4
info_findings: 3
acceptance_done: true
journeys_checked: 2
verification_passed: true
```

## Blocking Findings

{If any BLOCK-level findings, list them with file:line and agent source. If none, write "None".}

## Notes

{Any manual observations, edge cases, or follow-ups the user should know about.}
```

## Step 3: Append to Log

Also append a one-line summary to `.claude/receipts/INDEX.md`:

```
- 2026-04-12 14:30 | infra/harness-v2 | 5 agents, 0 BLOCK, acceptance ✓ | receipts/2026-04-12-1430-infra-harness-v2.md
```

If `INDEX.md` doesn't exist, create it with a header.

## Rules

- **Severity terms must match the manifest** (`.claude/manifests/agent-workflow.yml` → `severity`): use `BLOCK`/`WARN`/`INFO`/`N_A` only
- If `acceptance_done: false`, highlight which mandatory acceptance agents were skipped — this is a quality gate violation
- If `blocking_findings > 0`, the receipt MUST list them in the "Blocking Findings" section
- Receipt files are local audit trails — add to `.gitignore` unless the user wants them committed
- Keep the main receipt file ≤ 100 lines

## Failure Modes to Record

If something went wrong, record it:
- Agent returned no output (mark as `ERROR`)
- Agent timed out (mark as `TIMEOUT`)
- Acceptance skipped without reason (flag as `QUALITY GATE VIOLATION`)
- Journey paths failed validation (include `lint:journeys` output)
