-- ============================================================
-- Draft Migration: Add hook + EC profile fields to School table
-- ============================================================
--
-- USAGE:
--   1. Review this SQL
--   2. Add corresponding Prisma fields to apps/api/prisma/schema.prisma School model:
--
--      legacyClassPct           Decimal? @db.Decimal(5,4)
--      athleteClassPct          Decimal? @db.Decimal(5,4)
--      firstGenClassPct         Decimal? @db.Decimal(5,4)
--      legacyAdmitMultiplier    Decimal? @db.Decimal(4,2)  // for Bayesian update
--      athleteAdmitMultiplier   Decimal? @db.Decimal(4,2)
--      -- EC profile (Phase P1.5, lower confidence)
--      admitsWithNationalAwardPct  Decimal? @db.Decimal(5,4)
--      admitsWithLeadershipPct     Decimal? @db.Decimal(5,4)
--      admitsAvgActivityCount      Decimal? @db.Decimal(4,2)
--      admitsWithSpikePct          Decimal? @db.Decimal(5,4)
--      admitsWithResearchPct       Decimal? @db.Decimal(5,4)
--      -- metadata
--      admitProfileSource         String?
--      admitProfileConfidenceTier String?  // HIGH | MEDIUM | LOW
--      admitProfileUpdatedAt      DateTime?
--      admitProfileCycleYear      Int?
--
--   3. Run: pnpm --filter api db:migrate -- --name add_hook_and_ec_fields
--   4. Prisma will generate the actual migration SQL — this draft is for reference

-- Hook % of class
ALTER TABLE "School" ADD COLUMN "legacyClassPct"          DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "athleteClassPct"         DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "firstGenClassPct"        DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "legacyAdmitMultiplier"   DECIMAL(4,2);
ALTER TABLE "School" ADD COLUMN "athleteAdmitMultiplier"  DECIMAL(4,2);

-- EC profile (P1.5)
ALTER TABLE "School" ADD COLUMN "admitsWithNationalAwardPct" DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "admitsWithLeadershipPct"    DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "admitsAvgActivityCount"     DECIMAL(4,2);
ALTER TABLE "School" ADD COLUMN "admitsWithSpikePct"         DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "admitsWithResearchPct"      DECIMAL(5,4);

-- Provenance / metadata
ALTER TABLE "School" ADD COLUMN "admitProfileSource"         TEXT;
ALTER TABLE "School" ADD COLUMN "admitProfileConfidenceTier" TEXT;
ALTER TABLE "School" ADD COLUMN "admitProfileUpdatedAt"      TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN "admitProfileCycleYear"      INTEGER;

-- ============================================================
-- Notes
-- ============================================================
-- 1. All new fields are NULLABLE — no default required, no downtime risk
-- 2. legacyClassPct = 0.16 means 16% of admitted class are legacies
-- 3. legacyAdmitMultiplier = 5.5 means legacy admit rate = 5.5× overall rate
-- 4. admitProfileConfidenceTier ∈ {HIGH, MEDIUM, LOW} per V2 design §3
-- 5. Cycle year 2024 = data published in 2024-25 academic year, Class of 2028 admits
