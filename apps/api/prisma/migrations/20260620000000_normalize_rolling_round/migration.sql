-- Normalize the legacy mixed-case 'Rolling' application round to the canonical
-- 'ROLLING' (matches the shared ApplicationRound union + every consumer). The
-- column is free text; this is a data-only fix with no schema change. No-op on
-- DBs that never stored 'Rolling'.
UPDATE "ApplicationTimeline" SET "round" = 'ROLLING' WHERE "round" = 'Rolling';
UPDATE "SchoolDeadline" SET "round" = 'ROLLING' WHERE "round" = 'Rolling';
