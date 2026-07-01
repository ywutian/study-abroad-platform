-- Add optional weighted GPA (nullable, additive — no downtime).
-- `Profile.gpa` stays the unweighted figure; weightedGpa can exceed the scale
-- (e.g. 4.32 on a 4.0 scale) thanks to AP/Honors bonuses.
ALTER TABLE "Profile" ADD COLUMN "weightedGpa" DECIMAL(5,2);

-- Widen TestScore.score from Int to Float for half-point scales: the 2026 TOEFL
-- scale is 1.0–6.0 in half-point steps and IELTS uses x.5 bands. Int -> double
-- precision is a lossless widening; existing integer scores are unaffected.
ALTER TABLE "TestScore" ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION;
