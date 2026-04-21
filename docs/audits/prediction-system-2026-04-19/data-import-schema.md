# Read-only Import Schema

## Required CSV files

- prediction_result.csv
- prediction_outcome_label_record.csv
- school.csv

## Optional CSV files

- admission_case.csv
- school_recommendation.csv
- school_list_item.csv

## Required columns

- `prediction_result`: `id, profileId, schoolId, source, modelVersion, probability, probabilityLow, probabilityHigh, tier, confidence, applicationRound, applicationYear, cohortKey, createdAt`
- `prediction_outcome_label_record`: `predictionResultId, result, status, isFinal, createdAt, resolvedAt, notes, evidenceUrl`
- `school`: `id, name, nameZh, acceptanceRate, intlAcceptanceRate, satAvg, sat25, sat75, actAvg, act25, act75, usNewsRank`

## Truth rules

- Only `COUNSELOR_VERIFIED` / `DOCUMENT_VERIFIED` + `ADMITTED`/`REJECTED` enter formal accuracy.
- `SELF_REPORTED`, `WAITLISTED`, `DEFERRED`, `WITHDRAWN`, and unresolved states stay out of the headline accuracy metric.
- SQL dumps are intentionally not executed by this runner; export read-only CSVs instead.
