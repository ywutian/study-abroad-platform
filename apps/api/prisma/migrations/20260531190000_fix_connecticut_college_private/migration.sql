-- Connecticut College is a PRIVATE liberal-arts college, mislabeled isPrivate=false in prod
-- (surfaced by the 2026-05-31 48-flagship in-state audit, which expected the CT public flagship
-- to be the University of Connecticut). A private school must not receive any public/residency
-- treatment in the prediction geo modifier. Auto-applied to prod via `prisma migrate deploy`;
-- no-op on fresh/CI databases. Idempotent.
UPDATE "School" SET "isPrivate" = true WHERE "nameNorm" = 'connecticut college' AND "isPrivate" = false;
