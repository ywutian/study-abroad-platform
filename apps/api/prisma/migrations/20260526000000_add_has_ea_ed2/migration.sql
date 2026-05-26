-- Add hasEarlyAction + hasEarlyDecision2 columns to School table.
--
-- BACKGROUND: The counselor engine (counselor-modifiers.ts:638,665) already
-- reads `school.hasEarlyAction` and `school.hasEarlyDecision2` via
-- `(school as any).field` casts in the prediction transformer, but these
-- columns were missing from the schema. Runtime value was always undefined,
-- so the `=== false` guard in roundMultiplier silently failed.
--
-- Impact (pre-fix, verified at runtime):
--   - Stanford EA round → ×1.30 boost (should be neutral; Stanford only
--     offers SCEA)
--   - Pomona EA round → ×1.30 boost (should be neutral; Pomona is ED-only)
--   - ED2 round at every school reused ED1 admit rate (wrong for ED1-only
--     schools)
--
-- Both columns are nullable with no default — safe additive migration.
-- Backfill happens via prisma/seeds/backfill-has-ea-ed2.ts after deploy.

ALTER TABLE "School"
  ADD COLUMN "hasEarlyDecision2" BOOLEAN,
  ADD COLUMN "hasEarlyAction"    BOOLEAN;

-- Indexes for the engine's round-guard predicate (matches existing
-- hasEarlyDecision pattern at line 1565 of schema.prisma).
CREATE INDEX "School_hasEarlyAction_idx"    ON "School" ("hasEarlyAction");
CREATE INDEX "School_hasEarlyDecision2_idx" ON "School" ("hasEarlyDecision2");
