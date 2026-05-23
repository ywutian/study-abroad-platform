# Consumer Fact Safety Worklist

Status: CONSUMER_FACT_SAFETY_READY
Generated at: 2026-05-22T11:44:54.974Z

## Summary

- Total rows: 11
- Trusted rows: 11
- Review rows: 0
- Blocked rows: 0
- Missing source gate rows: 0
- Missing freshness gate rows: 0
- Missing conflict gate rows: 0
- Unsafe signal rows: 0

## Next Campaign

- All configured P0/P1 runtime consumer fact-safety checks are trusted.

## Rows

| Row | State | Consumer | Surface | Missing gates | Unsafe signals | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| application_analysis_policy_evidence_gate | trusted | application-analysis | application analysis policy card | none | none | accept |
| ai_essay_tools_prompt_source_gate | trusted | chat | AI essay prompt search and review context | none | none | accept |
| ai_school_tools_fact_source_gate | trusted | chat | AI school details and school comparison tools | none | none | accept |
| ai_timeline_deadline_source_gate | trusted | chat | AI timeline deadline tool | none | none | accept |
| essay_public_prompt_source_gate | trusted | essay | public essay prompt endpoints | none | none | accept |
| prediction_school_anchor_trust_gate | trusted | prediction | prediction school anchor transformer | none | none | accept |
| recommendation_essay_prompt_source_gate | trusted | recommendation | recommendation essayPromptCount and hasWhySchool | none | none | accept |
| recommendation_school_meta_source_gate | trusted | recommendation | recommendation schoolMeta and probability anchors | none | none | accept |
| school_list_essay_count_source_gate | trusted | school-list | school-list essayPromptCount | none | none | accept |
| timeline_deadline_generation_source_gate | trusted | timeline | ApplicationTimeline generation from SchoolDeadline/metadata | none | none | accept |
| timeline_essay_task_source_gate | trusted | timeline | ApplicationTask essay prompt generation | none | none | accept |
