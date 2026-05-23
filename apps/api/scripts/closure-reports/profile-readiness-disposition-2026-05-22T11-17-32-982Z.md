# Profile Readiness Disposition Packet

Status: READINESS_DISPOSITION_PACKET_READY
Generated at: 2026-05-22T11:17:32.996Z
Worklist: scripts/closure-reports/profile-readiness-worklist-2026-05-22T11-11-39-418Z.json

## Summary

- Open rows: 500
- Disposition rows: 500
- Unmapped rows: 0
- Blocked rows: 0
- Admin delivery blocked rows: 0

## Contract

- Missing first-party signals are user-prompt/operator/system-generation dispositions, not inferred facts.
- Default output uses anonymized recipient/profile keys.
- This packet does not send notifications or write profile data.

## Top Disposition Groups

| Group | Rows | Weighted score | Highest severity |
| --- | ---: | ---: | --- |
| school_list:prompt-user:school_list.add_first | 167 | 835 | critical |
| profile:prompt-user:profile.gpa_anchor | 128 | 640 | critical |
| profile:prompt-user:profile.major | 99 | 495 | critical |
| profile:prompt-user:profile.test_strategy | 94 | 470 | critical |
| profile:prompt-user:profile.missing | 4 | 20 | critical |
| prediction:run-prediction:prediction.missing | 5 | 15 | warning |
| deadline:review-deadline-source:deadline.round_missing | 2 | 6 | warning |
| application_analysis:run-prediction:application_analysis.predictions_required | 1 | 3 | warning |
