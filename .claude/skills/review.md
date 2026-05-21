---
name: review
description: Post-generation comprehensive code review — runs relevant agents as sensors on recent changes
---

# Post-Generation Review

You are running a **post-generation sensor** — reviewing code that was just written or modified in this conversation. The goal is to catch issues before commit, not to redesign.

## Step 1: Detect What Changed

Run `git diff --name-only HEAD` (or `git diff --cached --name-only` if files are staged) to identify all changed files. Classify each file:

| File Pattern | Category |
|---|---|
| `apps/api/**` | backend |
| `apps/web/**` | frontend |
| `apps/mobile/**` | mobile |
| `**/ai-agent/**`, `**/prediction/**` | ai |
| `prisma/schema.prisma` | database |
| `packages/shared/**` | shared |

## Step 2: Select Review Agents

**Read `.claude/manifests/agent-workflow.yml`** — use the `selection.by_change_type` section to pick agents based on detected categories. Apply `cross_cutting` rules on top.

Map detected categories to change types:
- Single category matches → use that change type's agents
- 2+ categories → use `full_stack` agents
- `database` category → also add `db_change` agents

Always include Integration Checker if 2+ categories are affected (even if not in the matrix).

## Step 3: Agent Review Scope

Tell each agent:
- Review ONLY the changed files (provide the diff)
- Report issues using unified severity from the manifest: **N_A** (not relevant) / **BLOCK** (must fix) / **WARN** (should fix) / **INFO** (suggestion)
- Keep output under 200 words per agent
- Check against the project's rules (`.claude/rules/`) and module BRIEF.md

## Step 4: Synthesize Report

Combine agent findings into a single report:

```
## Review Summary

**Files reviewed**: N files across [categories]

### BLOCK (must fix)
- [file:line] Issue description — [agent name]

### WARN (should fix)
- [file:line] Issue description — [agent name]

### INFO (suggestions)
- [file:line] Issue description — [agent name]

### Checks Passed
- [List agents that found no issues]
```

## Step 5: Auto-fix BLOCKers

If there are BLOCK-tier issues, offer to fix them. For WARN-tier, list them but let the user decide.

## Rules

- Do NOT re-architect or refactor — only flag violations of existing patterns
- Do NOT add features or "improvements" beyond what's needed
- Trust the project conventions in CLAUDE.md and `.claude/rules/`
- If no issues found, say so concisely — don't invent problems
