# Cases And Outcomes Disposition Packet

Status: CASES_OUTCOMES_DISPOSITION_READY
Generated at: 2026-05-21T02:41:20.456Z

## Summary

- Total rows: 109
- Emitted rows: 109
- Admission cases: 99
- Verified cases: 8
- Outcome labels: 10
- Verification requests: 0
- Prediction feedback: 0
- Unmapped rows: 0
- Truncated rows: 0

## Contract

- This packet is read-only and does not write DB rows.
- It exports anonymized keys, not raw user IDs.
- It does not export verification proof data, essay content, or feedback notes.
- Cases, labels, and feedback remain diagnostic-only for prediction unless a future ADR approves another workflow.

## Top Review Groups

| Group | Rows |
| --- | ---: |
| admission_case:review_pending_case | 73 |
| admission_case:review_missing_provenance_case | 13 |

## Top Diagnostic Groups

| Group | Rows |
| --- | ---: |
| outcome_label:self_reported_diagnostic_only | 10 |
| admission_case:community_diagnostic_only | 5 |
