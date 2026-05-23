# Essay Prompt Disposition Packet

Status: ESSAY_PROMPT_DISPOSITION_READY
Generated at: 2026-05-21T03:05:58.461Z
Worklist: ../../../../../../tmp/essay-prompt-worklist-latest.json

## Summary

- Total rows: 499
- Source gap rows: 194
- Source-search rows: 188
- Review rows: 274
- DB-schema blocked rows: 6
- Terminal old-cycle rows: 37
- Blocked rows: 0

## Contract

- This packet is read-only and does not create `EssayPromptSource` rows.
- It does not export raw source content.
- Public and timeline consumers remain source-gated until source rows exist.

## Top Review Groups

| Group | Rows |
| --- | ---: |
| audit.log_missing:audit-log-review:review_missing_prompt_audit_log | 231 |
| source.rows_missing:source-search:source_search_continue_after_validation_miss | 188 |
| source.raw_content_missing:raw-evidence-review:review_source_raw_content_missing | 37 |
| source.rows_missing:source-search:review_approved_source_blocked_by_db_schema | 6 |
