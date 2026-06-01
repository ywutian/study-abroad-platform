-- Per-school in-state/resident admit rates (2026-05-31 research workflow, non-UC publics).
-- Populates inStateAcceptanceRate so the prediction geo modifier uses real published
-- in-state÷overall directly; also corrects a few stale overall/oos values for consistency.
-- Auto-applied to prod via `prisma migrate deploy`. No-op on fresh/CI DBs. Idempotent.

UPDATE "School" SET "inStateAcceptanceRate" = 74.3, "oosAcceptanceRate" = 50.75 WHERE "nameNorm" = 'purdue university';
UPDATE "School" SET "inStateAcceptanceRate" = 46.98 WHERE "nameNorm" = 'university of georgia';
UPDATE "School" SET "inStateAcceptanceRate" = 59 WHERE "nameNorm" = 'texas a&m university';
UPDATE "School" SET "inStateAcceptanceRate" = 47.65 WHERE "nameNorm" = 'virginia tech';
UPDATE "School" SET "inStateAcceptanceRate" = 34 WHERE "nameNorm" = 'william & mary';
UPDATE "School" SET "inStateAcceptanceRate" = 75 WHERE "nameNorm" = 'indiana university bloomington';
UPDATE "School" SET "inStateAcceptanceRate" = 48.85 WHERE "nameNorm" = 'north carolina state university';
UPDATE "School" SET "inStateAcceptanceRate" = 76.17 WHERE "nameNorm" = 'university of south carolina';
UPDATE "School" SET "inStateAcceptanceRate" = 30.79 WHERE "nameNorm" = 'san diego state university';
UPDATE "School" SET "inStateAcceptanceRate" = 69.12 WHERE "nameNorm" = 'university of texas at dallas';
UPDATE "School" SET "inStateAcceptanceRate" = 87.82 WHERE "nameNorm" = 'george mason university';
UPDATE "School" SET "inStateAcceptanceRate" = 86.15 WHERE "nameNorm" = 'washington state university';
UPDATE "School" SET "inStateAcceptanceRate" = 88.45 WHERE "nameNorm" = 'illinois state university';
UPDATE "School" SET "inStateAcceptanceRate" = 99.98 WHERE "nameNorm" = 'ball state university';
UPDATE "School" SET "inStateAcceptanceRate" = 74.82 WHERE "nameNorm" = 'texas tech university';
UPDATE "School" SET "inStateAcceptanceRate" = 73.12 WHERE "nameNorm" = 'university of north texas';
UPDATE "School" SET "inStateAcceptanceRate" = 85.09, "acceptanceRate" = 84.61 WHERE "nameNorm" = 'san jose state university';
UPDATE "School" SET "inStateAcceptanceRate" = 90.26 WHERE "nameNorm" = 'university of idaho';
UPDATE "School" SET "inStateAcceptanceRate" = 45.46 WHERE "nameNorm" = 'california state university, long beach';
UPDATE "School" SET "inStateAcceptanceRate" = 91.11 WHERE "nameNorm" = 'california state university, fullerton';
UPDATE "School" SET "inStateAcceptanceRate" = 96.7 WHERE "nameNorm" = 'university of wisconsin-milwaukee';
UPDATE "School" SET "inStateAcceptanceRate" = 87.25 WHERE "nameNorm" = 'university of texas at san antonio';
UPDATE "School" SET "inStateAcceptanceRate" = 79.32 WHERE "nameNorm" = 'indiana university-purdue university indianapolis';
UPDATE "School" SET "inStateAcceptanceRate" = 93.42 WHERE "nameNorm" = 'old dominion university';
UPDATE "School" SET "inStateAcceptanceRate" = 66.01 WHERE "nameNorm" = 'james madison university';
UPDATE "School" SET "inStateAcceptanceRate" = 88.68 WHERE "nameNorm" = 'appalachian state university';
UPDATE "School" SET "inStateAcceptanceRate" = 79.37 WHERE "nameNorm" = 'university of north carolina wilmington';
UPDATE "School" SET "inStateAcceptanceRate" = 94.42 WHERE "nameNorm" = 'california state university, sacramento';
UPDATE "School" SET "inStateAcceptanceRate" = 80.37 WHERE "nameNorm" = 'towson university';
UPDATE "School" SET "acceptanceRate" = 86.6 WHERE "nameNorm" = 'university of hawaii at manoa';
