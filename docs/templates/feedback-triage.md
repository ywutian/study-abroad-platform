# Feedback Triage Template

> Copy this template for each feedback batch. Fill in the triage table BEFORE writing any code.

## Source Info

| Field             | Value                                     |
| ----------------- | ----------------------------------------- |
| **Feedback from** | (name)                                    |
| **Date received** | (YYYY-MM-DD)                              |
| **Channel**       | (WeChat / Email / Meeting / GitHub Issue) |
| **Total items**   | (count)                                   |

---

## Triage Table

| ID  | Description | Category | Root Cause | Acceptance Criteria | Batch | Status |
| --- | ----------- | -------- | ---------- | ------------------- | ----- | ------ |
| 1   |             |          |            |                     |       | `open` |
| 2   |             |          |            |                     |       | `open` |
| 3   |             |          |            |                     |       | `open` |

### Column Guide

- **ID**: Sequential number within this feedback batch
- **Description**: One-line summary of the feedback item (user's words, not interpretation)
- **Category**: One of the 5 categories below
- **Root Cause**: Technical root cause (e.g., "profile.activities is empty", "missing dark: variant on badge")
- **Acceptance Criteria**: User-visible outcome that proves the issue is fixed (NOT "code was changed")
- **Batch**: Group number (1-3 items per batch, related items together)
- **Status**: `open` | `in-progress` | `verified` | `wontfix`

---

## Category Decision Tree

```
Is there existing code that handles this feature?
  YES -> Does the code produce the wrong output?
    YES -> CODE_BUG
    NO  -> Is the issue caused by missing/bad data?
      YES -> DATA_ISSUE
      NO  -> Does the user misunderstand what the feature does?
        YES -> UX_CONFUSION
        NO  -> INDUSTRY_SUGGESTION (domain expert advice on business logic)
  NO -> NEW_FEATURE
```

### Category Definitions

| Category              | Definition                                                | Fix approach                                                            |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `CODE_BUG`            | Code does X, should do Y. Reproducible with correct data. | Fix the code logic.                                                     |
| `DATA_ISSUE`          | Code is correct but data is missing, empty, or wrong.     | Fix data pipeline, add seed data, or surface data completeness to user. |
| `UX_CONFUSION`        | Feature works correctly but user doesn't understand it.   | Improve labels, add tooltips, restructure UI flow.                      |
| `NEW_FEATURE`         | Requested functionality doesn't exist yet.                | Design and implement new feature.                                       |
| `INDUSTRY_SUGGESTION` | Domain expert advice on business logic accuracy.          | Consult study-abroad-expert agent, update business rules.               |

---

## Acceptance Criteria Examples

**Good** (user-visible outcome):

- "User sees specific program names (RSI, MOSTEC, Clark Scholars) in prediction suggestions when profile has CS major and 2+ activities"
- "GPA field displays 'Not provided' instead of '0.0' when user hasn't entered GPA"
- "School card shows US News ranking badge with tooltip explaining the source"

**Bad** (code-centric, not verifiable by user):

- "Updated prompt template to include program names"
- "Changed GPA default value in component"
- "Added ranking data to school query"

---

## Batch Grouping Guidelines

1. **Max 3 items per batch** — keeps PRs reviewable and rollback-safe
2. **Group by proximity** — items touching the same files/module go together
3. **Dependencies first** — if item B depends on item A's fix, put A in an earlier batch
4. **Mix categories carefully** — a `CODE_BUG` + `DATA_ISSUE` in the same module is fine; a `CODE_BUG` + unrelated `NEW_FEATURE` is not
5. **Isolate risky items** — `NEW_FEATURE` or large `UX_CONFUSION` rewrites get their own batch

---

## Per-Batch Workflow Checklist

### Before coding

- [ ] All items in this batch have Category + Root Cause + Acceptance Criteria filled in
- [ ] Ambiguous items have been clarified with the user (decision recorded in Root Cause column)
- [ ] Implementation plan reviewed by relevant agents (per CLAUDE.md Phase 1)

### During coding

- [ ] Run `npx tsx scripts/verify-gate.ts --staged` before each commit
- [ ] Each commit message references the feedback item ID (e.g., `fix(prediction): #20 add specific program names`)

### After coding

- [ ] Each item's Acceptance Criteria verified (not just "code compiles")
- [ ] Status updated to `verified` or `wontfix` (with reason)
- [ ] Resolution documented in `docs/USER_FEEDBACK_ANALYSIS_*.md`

---

## Example: Carol Item #20

| ID  | Description                                              | Category     | Root Cause                                                                                                                                                               | Acceptance Criteria                                                                                                                                                          | Batch | Status |
| --- | -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| 20  | Prediction suggestions too general, no specific programs | `DATA_ISSUE` | Demo profile has empty activities/awards. Prompt rules #6-#7 require activity data to generate specific suggestions. Even with good prompt, empty data = generic output. | With a profile containing CS major + 2 activities + 1 award: suggestions include 3+ named programs (e.g., RSI, USACO, PRIMES) relevant to the student's major and activities | 5     | `open` |

**Lesson**: This was initially classified as a prompt issue and "fixed" by improving prompt rules. But the real root cause was DATA_ISSUE — the demo profile had no activities. The prompt was already correct; it just had nothing to work with. Proper triage would have caught this in Phase 1.
