-- Per-school in-state/resident freshman admit rate (symmetric with oosAcceptanceRate).
-- The prediction geo modifier uses inState/overall directly when published, falling back to
-- the per-state map + selectivity damping otherwise. Nullable → safe online add, no backfill.
ALTER TABLE "School" ADD COLUMN "inStateAcceptanceRate" DECIMAL(5,2);
