-- Adds two opt-in Profile fields powering the Counselor Engine's hook modifiers.
-- Both columns are nullable / default-false so existing profiles see no behavior
-- change; the prediction-counselor-mode-v1 feature flag controls when these
-- fields are read by the engine.
--
-- recruitedAthlete: true = Profile.athleteMultiplier returns 4.0 (recruited
--   athletes at peer institutions see 4-15× the baseline admit rate per
--   institutional CDS data; counselor uses conservative 4.0)
-- urmStatus: 'BLACK' | 'HISPANIC' | 'NATIVE_AMERICAN' | 'PACIFIC_ISLANDER'
--   triggers urmMultiplier 1.5 at need-blind schools (post-SFFA contextual review).
--   'PREFER_NOT_SAY' or NULL = no effect.
--
-- Rollback: DROP COLUMN both columns. No FK / index dependencies.

ALTER TABLE "Profile"
  ADD COLUMN "recruitedAthlete" BOOLEAN DEFAULT false,
  ADD COLUMN "urmStatus" TEXT;
