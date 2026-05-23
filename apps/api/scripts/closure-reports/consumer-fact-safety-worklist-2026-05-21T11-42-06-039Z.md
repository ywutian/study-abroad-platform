# Consumer Fact Safety Worklist

Status: CONSUMER_FACT_SAFETY_REVIEW
Generated at: 2026-05-21T11:42:06.056Z

## Summary

- Total rows: 11
- Trusted rows: 8
- Review rows: 3
- Blocked rows: 0
- Missing source gate rows: 0
- Missing freshness gate rows: 0
- Missing conflict gate rows: 0
- Unsafe signal rows: 3

## Next Campaign

- application-analysis application analysis policy card has review fact-safety row application_analysis_policy_evidence_gate; first action: separate-approved-evidence-from-review-only-fallbacks.

## Rows

| Row | State | Consumer | Surface | Missing gates | Unsafe signals | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| application_analysis_policy_evidence_gate | review | application-analysis | application analysis policy card | none | raw_policy_fallback; metadata_standard_deadline_fallback | separate-approved-evidence-from-review-only-fallbacks |
| prediction_school_anchor_trust_gate | review | prediction | prediction school anchor transformer | none | missing_provenance_allows_value; heuristic_inferred_exception | harden-prediction-provenance-fallback-policy |
| timeline_essay_task_source_gate | review | timeline | ApplicationTask essay prompt generation | none | generic_school_essay_task | link-generated-essay-tasks-to-source-backed-prompts |
| ai_essay_tools_prompt_source_gate | trusted | chat | AI essay prompt search and review context | none | none | accept |
| ai_school_tools_fact_source_gate | trusted | chat | AI school details and school comparison tools | none | none | accept |
| ai_timeline_deadline_source_gate | trusted | chat | AI timeline deadline tool | none | none | accept |
| essay_public_prompt_source_gate | trusted | essay | public essay prompt endpoints | none | none | accept |
| recommendation_essay_prompt_source_gate | trusted | recommendation | recommendation essayPromptCount and hasWhySchool | none | none | accept |
| recommendation_school_meta_source_gate | trusted | recommendation | recommendation schoolMeta and probability anchors | none | none | accept |
| school_list_essay_count_source_gate | trusted | school-list | school-list essayPromptCount | none | none | accept |
| timeline_deadline_generation_source_gate | trusted | timeline | ApplicationTimeline generation from SchoolDeadline/metadata | none | none | accept |
