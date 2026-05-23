# AI Memory Disposition Packet

Status: AI_MEMORY_DISPOSITION_READY
Generated at: 2026-05-21T02:48:38.401Z

## Summary

- Total memories: 385
- Emitted rows: 385
- Missing consent rows: 385
- Missing provenance rows: 0
- No-expiry rows: 385
- High-sensitivity rows: 334
- Review rows: 385
- Trusted rows: 0

## Contract

- This packet is read-only and does not write DB rows.
- It exports anonymized keys, not raw user IDs.
- It does not export memory content.
- Chat and application-analysis consumers must treat review rows as weak-state context, not sourced facts.

## Top Review Groups

| Group | Rows |
| --- | ---: |
| FACT:test_score:review_missing_memory_consent_preference | 199 |
| DECISION:school_prediction:review_missing_memory_consent_preference | 38 |
| FEEDBACK:improvement:review_missing_memory_consent_preference | 29 |
| FACT:profile_update:review_missing_memory_consent_preference | 24 |
| FACT:profile_analysis:review_missing_memory_consent_preference | 21 |
| FACT:activity:review_missing_memory_consent_preference | 19 |
| DECISION:school_recommendation:review_missing_memory_consent_preference | 15 |
| FACT:prediction_feedback:review_missing_memory_consent_preference | 10 |
| FACT:award:review_missing_memory_consent_preference | 7 |
| PREFERENCE:profile:review_missing_memory_consent_preference | 5 |
| DECISION:swipe_prediction:review_missing_memory_consent_preference | 4 |
| FEEDBACK:essay_review:review_missing_memory_consent_preference | 4 |
