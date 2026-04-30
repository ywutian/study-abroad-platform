-- Add Early Decision / Early Action admit rates and freshman GPA distribution
-- to School. Sourced from CDS Section C21 (ED/EA breakdown) and Section C9
-- (freshman class profile). All fields nullable; counselor engine falls back
-- to heuristic multipliers when missing.

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "edAcceptanceRate" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "eaAcceptanceRate" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "gpaDistribution" JSONB;
