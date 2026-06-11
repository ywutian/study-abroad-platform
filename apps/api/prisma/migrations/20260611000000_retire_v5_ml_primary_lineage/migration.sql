-- Cleanup after PR #385 (servedPolicyVersionId root-fix).
--
-- The served path no longer reads the DB ACTIVE policy row (servedPolicyVersionId
-- now tracks the counselor engine's COUNSELOR_RULE_VERSION), so the 2026-04-23
-- ML-era "v5-ml-primary" PredictionPolicyVersion — left ACTIVE after the ML/v5
-- code was deleted 2026-05-07 — is now an inert ghost. This migration removes the
-- ghost ACTIVE row and scrubs the dead label from historical prediction lineage
-- so admin/raw-API surfaces stop echoing it. Data-only, idempotent (re-runnable),
-- no schema change. NULL is a valid FK (policyVersionId is String? onDelete:SetNull);
-- the reporting/dashboard mappers use `?? undefined` so they stop exposing the
-- dead label, and the next predict re-stamps counselor via the persistence
-- self-heal (ensureCounselorPolicyVersion).

-- 1. Drop the stale ML-era policy version out of ACTIVE.
UPDATE "PredictionPolicyVersion"
SET "status" = 'RETIRED', "retiredAt" = COALESCE("retiredAt", now())
WHERE "id" = 'v5-ml-primary' AND "status" <> 'RETIRED';

-- 2. Scrub the dead ML label from historical prediction + snapshot lineage.
UPDATE "PredictionResult"
SET "policyVersionId" = NULL
WHERE "policyVersionId" = 'v5-ml-primary';

UPDATE "PredictionSnapshot"
SET "policyVersionId" = NULL
WHERE "policyVersionId" = 'v5-ml-primary';
