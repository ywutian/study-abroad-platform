---
name: audit-drift
description: Check for drift between BRIEF.md documentation and actual code, rules accuracy, and architecture constraints
---

# Audit Drift

Detect documentation drift, architecture violations, and stale references across the project.

## Arguments

Optional: `{scope}` — `all` (default), `backend`, `frontend`, `rules`, `briefs`

## Check 1: BRIEF.md Accuracy (scope: briefs, all)

For each BRIEF.md in `apps/api/src/modules/*/BRIEF.md` and `apps/web/src/components/features/*/BRIEF.md`:

1. Read the BRIEF.md
2. List the actual files in the directory (`ls`)
3. Compare: does the BRIEF.md mention files/exports/patterns that no longer exist?
4. Check: are there significant files NOT mentioned in the BRIEF.md?

Report:
```
| Module | Status | Drift Details |
|--------|--------|---------------|
| auth | OK | — |
| prediction | DRIFT | BRIEF mentions `calibration.service.ts` but file was renamed to `calibrator.service.ts` |
```

## Check 2: Rules Glob Accuracy (scope: rules, all)

For each rule file in `.claude/rules/`:

| Rule File | Expected Glob |
|---|---|
| `backend.md` | `apps/api/**` |
| `frontend.md` | `apps/web/**` |
| `mobile.md` | `apps/mobile/**` |
| `ai-system.md` | `**/ai-agent/**`, `**/prediction/**`, `**/essay/**` |
| `security.md` | `**/auth/**`, `**/guards/**`, `**/vault/**` |
| `testing.md` | `**/*.spec.ts`, `**/*.test.ts` |
| `ci-cd.md` | `.github/**`, `*.sh`, `.husky/**` |

Verify:
1. The glob paths match actual directories that exist
2. The rules reference files/patterns that still exist in the codebase
3. No important new directories are missing from glob coverage

## Check 3: Architecture Constraint Drift (scope: backend, all)

Run the existing governance checks:
```bash
npx tsx scripts/check-integration.ts --domain=governance --verbose
npx tsx scripts/check-api-quality.ts
```

Report any new violations.

## Check 4: Module Boundary Drift (scope: backend, all)

For each backend module, check imports:
- Services should only import from their own module or explicitly imported modules
- No circular dependencies between modules
- `@Global()` modules are used sparingly

```bash
# Quick circular dependency check
npx madge --circular apps/api/src/main.ts 2>/dev/null || echo "madge not installed — skip"
```

## Check 5: CLAUDE.md Accuracy (scope: all)

Verify the root CLAUDE.md:
1. Agent table row count == number of files in `.claude/agents/`
2. Context Routing paths all resolve to existing files
3. Rules Index matches actual `.claude/rules/` files
4. Command examples still work (spot-check 2-3)

## Output Format

```
## Drift Audit Report

**Scope**: {scope}
**Date**: {date}

### Summary
- BRIEF.md: X/Y accurate, Z drifted
- Rules: X/Y accurate
- Architecture: X violations
- CLAUDE.md: {status}

### Action Items
1. [BRIEF] Update `modules/prediction/BRIEF.md` — rename reference
2. [RULE] Add `**/essay-ai/**` to ai-system.md glob
3. [ARCH] Fix governance violation in `modules/chat/`

### No Issues Found
- [list of clean checks]
```

## Rules

- This is a READ-ONLY audit — do not modify files unless explicitly asked
- Report facts, not opinions — "file X doesn't exist" not "file X should be renamed"
- For large projects, sample 10 BRIEF.md files rather than all 38 (unless scope=briefs)
