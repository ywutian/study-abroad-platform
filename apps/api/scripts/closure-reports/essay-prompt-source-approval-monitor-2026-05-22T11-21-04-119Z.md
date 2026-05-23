# Essay Prompt Source Approval Monitor

Status: ESSAY_PROMPT_SOURCE_APPROVAL_MONITOR_COMPLETE
Generated at: 2026-05-22T11:21:04.124Z

## Summary

- Review queue rows: 11
- Review action target rows: 6
- Approval request rows: 0
- Pending approval candidates: 0
- Pending rows: 0
- Approved source rows: 0
- Schema blocked: yes
- Consumer gate closed: no
- Raw content stored: no

## Checks

| Check | Status | Summary | Missing |
| --- | --- | --- | --- |
| review_queue_consumer_policy_present | pass | Reviewer queue rows must carry consumer-hide policy before approval monitoring. | none |
| review_action_present_and_consumer_gate_open | pass | Reviewer action packet should exist while public/timeline consumers remain source-gated. | none |
| approval_request_rows_pending | pass | Approval gate should expose reviewer handoff rows without approving write workflow. | none |
| write_plan_non_writeable_pending_candidates | pass | Write plan must carry pending approval rows as non-writeable preflight candidates. | none |
| approval_write_plan_alignment | pass | Approval request rows and deduplicated write-plan pending candidates should align. | none |
| db_schema_still_blocks_essay_source_writes | pass | The monitor must preserve the global DB schema blocker instead of creating write permission. | none |
| monitor_rows_hash_only | pass | Monitor rows must carry raw-content hashes only, never raw source bodies. | none |
| consumer_policy_remains_hidden | pass | Essay public/timeline/chat consumers must remain hidden until source rows exist and the audit is rerun. | none |

## Pending Approval Rows

Showing 0 of 0 hash-only rows.

| School | Prompt ID | Source Quality | Source URL | Schema Blocked |
| --- | --- | --- | --- | --- |
| none | n/a | n/a | n/a | n/a |
