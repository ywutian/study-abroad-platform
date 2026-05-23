# Essay Prompt Source Review Approval Gate

Status: PASS_NO_REVIEW_CANDIDATES
Generated at: 2026-05-22T11:19:30.381Z
Decision: review-required
Approved for write workflow: no

## Summary

- Reviewer queue rows: 0
- Review-action constraint applied: no
- Review-action eligible source rows: n/a
- Review-action excluded source rows: n/a
- Approval request rows: 0
- Approval request prompt IDs: 0
- Approved source rows: 0
- Missing required inputs: decision, reviewerId, approvedWorkflow, operatorAck, sourceFamilyConfirmed, cycleYearConfirmed, rawSnapshotReviewed, promptFieldsReviewed, noConflictsConfirmed

## Approval Command Template

```bash
pnpm --filter api audit:essay-prompt-source-review-approval -- --staging '/Users/yitianwu/Documents/study-abroad-platform/apps/api/scripts/closure-reports/essay-prompt-source-review-staging-2026-05-22T11-19-16-073Z.json' --decision approve-reviewed-sources --reviewer-id <reviewer-id> --approved-workflow <approved-workflow-id> --operator-ack APPROVED_ESSAY_PROMPT_SOURCE_REVIEW --source-family-confirmed --cycle-year-confirmed --raw-snapshot-reviewed --prompt-fields-reviewed --no-conflicts-confirmed --out /tmp/essay-prompt-source-review-approval-latest.json --markdown /tmp/essay-prompt-source-review-approval-latest.md --csv /tmp/essay-prompt-source-review-approval-latest.csv
```

## Guardrails

- This artifact does not write the database.
- Public/timeline consumers remain source-gated until source rows exist in DB.
- DB schema compatibility must be resolved before any live write workflow.

## Reviewer Queue

| School | Candidate Rows | Source |
| --- | ---: | --- |

## Approval Request Rows

| School | Prompt ID | Source Type | Confidence | Raw Hash | Source |
| --- | --- | --- | ---: | --- | --- |

## Approved Source Rows

| School | Prompt ID | Source Type | Confidence | Source |
| --- | --- | --- | ---: | --- |
| None | n/a | n/a | 0 | n/a |

