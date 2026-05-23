# Profile Readiness Campaign Stack Monitor

Status: READINESS_CAMPAIGN_STACK_MONITOR_READY
Generated at: 2026-05-22T11:18:05.278Z

## Summary

- Tracked groups: 8
- Tracked disposition rows: 500
- Tracked ready rows: 500
- Active top campaign: school_list:prompt-user:school_list.add_first
- Active monitor pending rows: 167
- Target delivery monitor groups: none
- Monitored campaign groups: 1
- Unmonitored campaign groups: 7
- Ready parallel user-prompt groups: 4
- Ready unmonitored parallel user-prompt groups: 4
- Ready unmonitored parallel user-prompt rows: 325
- Next parallel ready group: profile:prompt-user:profile.gpa_anchor

## Checks

| Check | Status | Summary | Missing |
| --- | --- | --- | --- |
| disposition_stack_ready | pass | Campaign stack requires a ready disposition packet with every open row mapped. | none |
| top_groups_present | pass | Disposition packet should expose ranked campaign groups to monitor. | none |
| admin_delivery_anonymized | pass | Campaign stack monitor must use anonymized delivery rows by default. | none |
| stack_group_delivery_alignment | pass | Every tracked campaign group should align one-for-one with admin delivery rows. | none |
| stack_rows_ready | pass | Every tracked campaign group should have rows ready for its actor-specific queue. | none |
| user_prompt_live_channels_disabled | pass | User-prompt campaign groups must keep Redis, push, and email disabled. | none |
| user_prompt_suppression_rules_present | pass | User-prompt campaign groups need suppression rules before display. | none |
| active_top_campaign_monitor_aligned | pass | The active top campaign should be covered by the delivery monitor before parallel groups are considered. | none |

## Campaign Stack

| Rank | Group | Rows | Ready | Severity | State |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | school_list:prompt-user:school_list.add_first | 167 | 167 | critical | active_campaign_monitored |
| 2 | profile:prompt-user:profile.gpa_anchor | 128 | 128 | critical | ready_parallel_in_app_dashboard_preflight |
| 3 | profile:prompt-user:profile.major | 99 | 99 | critical | ready_parallel_in_app_dashboard_preflight |
| 4 | profile:prompt-user:profile.test_strategy | 94 | 94 | critical | ready_parallel_in_app_dashboard_preflight |
| 5 | profile:prompt-user:profile.missing | 4 | 4 | critical | ready_parallel_in_app_dashboard_preflight |
| 6 | prediction:run-prediction:prediction.missing | 5 | 5 | warning | ready_system_generation_queue |
| 7 | deadline:review-deadline-source:deadline.round_missing | 2 | 2 | warning | ready_operator_review_queue |
| 8 | application_analysis:run-prediction:application_analysis.predictions_required | 1 | 1 | warning | ready_system_generation_queue |
