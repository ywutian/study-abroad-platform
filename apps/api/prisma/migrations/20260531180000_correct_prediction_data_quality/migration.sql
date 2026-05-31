-- Prediction data-quality corrections (auto-applied to prod via `prisma migrate deploy`).
-- Mirrors the seed correction scripts (seed-intl-rate-correction / seed-round-rate-correction /
-- seed-audit-corrections-2026-05-31) so existing prod rows are fixed without a manual seed run.
-- No-op on fresh/CI databases (no rows yet); corrects the live prod data once. Idempotent.

-- (1) 48 intelligent-audit corrections (stale anchors / mislabeled fields), by nameNorm:
UPDATE "School" SET "acceptanceRate" = 80.5, "oosAcceptanceRate" = NULL, "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'university of colorado boulder';
UPDATE "School" SET "acceptanceRate" = 88.97, "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'new mexico state university';
UPDATE "School" SET "acceptanceRate" = 85.3 WHERE "nameNorm" = 'university of nevada, reno';
UPDATE "School" SET "acceptanceRate" = 72.6, "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'texas tech university';
UPDATE "School" SET "acceptanceRate" = 77.6 WHERE "nameNorm" = 'mississippi state university';
UPDATE "School" SET "acceptanceRate" = 70, "intlAcceptanceRate" = NULL, "oosAcceptanceRate" = NULL, "sat25" = NULL, "sat75" = NULL WHERE "nameNorm" = 'northern illinois university';
UPDATE "School" SET "acceptanceRate" = 69.7 WHERE "nameNorm" = 'university of hawaii at manoa';
UPDATE "School" SET "acceptanceRate" = 65.3, "oosAcceptanceRate" = 65.7 WHERE "nameNorm" = 'university of vermont';
UPDATE "School" SET "acceptanceRate" = 50.8, "oosAcceptanceRate" = 49.7 WHERE "nameNorm" = 'ohio state university';
UPDATE "School" SET "acceptanceRate" = 71.2, "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'university of denver';
UPDATE "School" SET "acceptanceRate" = 46.8, "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'university of san diego';
UPDATE "School" SET "acceptanceRate" = 89, "intlAcceptanceRate" = NULL, "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'university of wisconsin-milwaukee';
UPDATE "School" SET "acceptanceRate" = 75.04 WHERE "nameNorm" = 'saint louis university';
UPDATE "School" SET "acceptanceRate" = 50.3, "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'purdue university';
UPDATE "School" SET "acceptanceRate" = 73.25, "eaAcceptanceRate" = NULL WHERE "nameNorm" = 'pratt institute';
UPDATE "School" SET "acceptanceRate" = 77 WHERE "nameNorm" = 'school of the art institute of chicago';
UPDATE "School" SET "acceptanceRate" = 40 WHERE "nameNorm" = 'manhattan school of music';
UPDATE "School" SET "acceptanceRate" = 83, "oosAcceptanceRate" = NULL, "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'savannah college of art and design';
UPDATE "School" SET "acceptanceRate" = 76.8 WHERE "nameNorm" = 'maryland institute college of art';
UPDATE "School" SET "acceptanceRate" = 41.1 WHERE "nameNorm" = 'new england conservatory';
UPDATE "School" SET "acceptanceRate" = 91.1 WHERE "nameNorm" = 'california college of the arts';
UPDATE "School" SET "acceptanceRate" = 72.55 WHERE "nameNorm" = 'missouri university of science and technology';
UPDATE "School" SET "acceptanceRate" = 77.1, "sat25" = 1160, "sat75" = 1300 WHERE "nameNorm" = 'university of rhode island';
UPDATE "School" SET "acceptanceRate" = 9, "sat25" = NULL, "sat75" = NULL WHERE "nameNorm" = 'the juilliard school';
UPDATE "School" SET "acceptanceRate" = 96.33, "sat25" = 913, "sat75" = 1240 WHERE "nameNorm" = 'wright state university';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'rose-hulman institute of technology';
UPDATE "School" SET "intlAcceptanceRate" = NULL, "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'curtis institute of music';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'texas a&m university';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'clarkson university';
UPDATE "School" SET "intlAcceptanceRate" = NULL, "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'cleveland state university';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'university of toledo';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'wayne state university';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'university of georgia';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'harvey mudd college';
UPDATE "School" SET "intlAcceptanceRate" = NULL WHERE "nameNorm" = 'northeastern university';
UPDATE "School" SET "intlAcceptanceRate" = NULL, "eaAcceptanceRate" = 15.45 WHERE "nameNorm" = 'villanova university';
UPDATE "School" SET "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'massachusetts institute of technology';
UPDATE "School" SET "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'williams college';
UPDATE "School" SET "oosAcceptanceRate" = NULL, "eaAcceptanceRate" = NULL WHERE "nameNorm" = 'amherst college';
UPDATE "School" SET "oosAcceptanceRate" = NULL WHERE "nameNorm" = 'university of idaho';
UPDATE "School" SET "edAcceptanceRate" = 22.94 WHERE "nameNorm" = 'colgate university';
UPDATE "School" SET "edAcceptanceRate" = 37.06 WHERE "nameNorm" = 'case western reserve university';
UPDATE "School" SET "edAcceptanceRate" = 58 WHERE "nameNorm" = 'rensselaer polytechnic institute';
UPDATE "School" SET "edAcceptanceRate" = NULL WHERE "nameNorm" = 'university of san francisco';
UPDATE "School" SET "eaAcceptanceRate" = NULL WHERE "nameNorm" = 'university of north carolina at chapel hill';
UPDATE "School" SET "sat25" = 1280 WHERE "nameNorm" = 'university of washington';
UPDATE "School" SET "sat25" = 1180 WHERE "nameNorm" = 'university of california, irvine';
UPDATE "School" SET "sat25" = NULL, "sat75" = NULL WHERE "nameNorm" = 'worcester polytechnic institute';

-- (2) intl-rate contamination: null where intl >= overall (enrollment-% / overall-rate leak) or scale mismatch.
UPDATE "School" SET "intlAcceptanceRate" = NULL
WHERE "intlAcceptanceRate" IS NOT NULL AND "acceptanceRate" IS NOT NULL
  AND ("intlAcceptanceRate" >= "acceptanceRate" - 0.5 OR ("intlAcceptanceRate" < 1 AND "acceptanceRate" >= 1));

-- (3) round-rate scale errors: null implausibly-tiny (<1%) early-round rates.
UPDATE "School" SET "edAcceptanceRate"  = NULL WHERE "edAcceptanceRate"  IS NOT NULL AND "edAcceptanceRate"  < 1;
UPDATE "School" SET "ed2AcceptanceRate" = NULL WHERE "ed2AcceptanceRate" IS NOT NULL AND "ed2AcceptanceRate" < 1;
UPDATE "School" SET "eaAcceptanceRate"  = NULL WHERE "eaAcceptanceRate"  IS NOT NULL AND "eaAcceptanceRate"  < 1;
