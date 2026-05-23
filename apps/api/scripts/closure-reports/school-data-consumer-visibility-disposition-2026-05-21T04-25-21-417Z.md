# School Data Consumer Visibility Disposition Packet

Generated: 2026-05-21T04:25:21.409Z
Status: SCHOOL_CONSUMER_VISIBILITY_DISPOSITION_READY

## Summary

- Total rows: 57
- Trusted rows: 44
- Review rows: 13
- Critical review rows: 9
- Blocked rows: 0

## Next Campaign

- api_school_detail.gpaDistribution is review_add_consumer_reference; implement or terminalize this consumer-visibility gap next.

## Top Review Rows

- CRITICAL api_school_detail.gpaDistribution: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- CRITICAL prediction_engine.transferAcceptanceRate: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- CRITICAL web_prediction_results.act25: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- CRITICAL web_prediction_results.act75: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- CRITICAL web_prediction_results.intlAcceptanceRate: review_add_provenance_visibility (add-source-provenance-support-labels)
- CRITICAL web_prediction_results.needBlindInternational: review_add_provenance_visibility (add-source-provenance-support-labels)
- CRITICAL web_prediction_results.sat25: review_add_provenance_visibility (add-source-provenance-support-labels)
- CRITICAL web_prediction_results.sat75: review_add_provenance_visibility (add-source-provenance-support-labels)
- CRITICAL web_prediction_results.testingPolicy: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- WARNING agent_chat_context.campusCover: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- WARNING agent_chat_context.programRates: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- WARNING api_school_detail.programRates: review_add_consumer_reference (add-field-reference-or-mark-surface-terminal)
- WARNING web_school_pages.campusCover: review_add_provenance_visibility (add-source-provenance-support-labels)

## Review Contract

- This packet is read-only and does not change API/web/prediction consumers.
- Review dispositions are not trusted runtime usage; they are an explicit implementation queue.
- Missing references can close only through code evidence or explicit terminal rationale.
