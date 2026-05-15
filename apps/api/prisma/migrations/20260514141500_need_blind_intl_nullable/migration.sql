-- Make `needBlindInternational` nullable so we can distinguish
--   true  = verified need-blind for international applicants
--   false = verified need-aware for international applicants (admin-curated)
--   null  = not yet reviewed (the new default state for new and unreviewed rows)
--
-- Data backfill rationale (see ADR-0020):
-- Until 2026-05 the column was `BOOLEAN DEFAULT FALSE`, which meant every
-- un-reviewed school appeared identical to a verified need-aware school. The
-- only rows that were ever explicitly set to TRUE are the ones seeded by
-- prisma/seed-intl-schools.ts. Most other FALSE values are the schema default,
-- not a reviewer decision, so we reset those to NULL.
--
-- The set of "explicitly verified need-blind" schools is preserved by the
-- WHERE-clause: we only touch rows currently FALSE. Rows that are TRUE
-- (the trusted need-blind list) are untouched.
--
-- The verified need-aware list from prisma/seed-intl-schools.ts is also
-- preserved as FALSE, because those rows represent reviewed data rather than
-- the old schema default.

ALTER TABLE "School"
  ALTER COLUMN "needBlindInternational" DROP DEFAULT,
  ALTER COLUMN "needBlindInternational" DROP NOT NULL;

UPDATE "School"
  SET "needBlindInternational" = NULL
  WHERE "needBlindInternational" = FALSE
    AND "nameNorm" NOT IN (
      'stanford university',
      'columbia university',
      'university of pennsylvania',
      'cornell university',
      'duke university',
      'wellesley college',
      'pomona college',
      'swarthmore college',
      'middlebury college',
      'wesleyan university',
      'williams college',
      'tufts university',
      'johns hopkins university',
      'california institute of technology',
      'northwestern university',
      'vanderbilt university'
    );
