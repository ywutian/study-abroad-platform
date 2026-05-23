-- M3 v2 Bayesian Engine: Hook % + EC profile fields on School table
-- All NULLABLE — no defaults required, no downtime risk

ALTER TABLE "School" ADD COLUMN "legacyClassPct"             DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "athleteClassPct"            DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "firstGenClassPct"           DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "legacyAdmitMultiplier"      DECIMAL(5,2);
ALTER TABLE "School" ADD COLUMN "athleteAdmitMultiplier"     DECIMAL(5,2);

ALTER TABLE "School" ADD COLUMN "admitsWithNationalAwardPct" DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "admitsWithLeadershipPct"    DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "admitsAvgActivityCount"     DECIMAL(4,2);
ALTER TABLE "School" ADD COLUMN "admitsWithSpikePct"         DECIMAL(5,4);
ALTER TABLE "School" ADD COLUMN "admitsWithResearchPct"      DECIMAL(5,4);

ALTER TABLE "School" ADD COLUMN "admitProfileSource"         TEXT;
ALTER TABLE "School" ADD COLUMN "admitProfileConfidenceTier" TEXT;
ALTER TABLE "School" ADD COLUMN "admitProfileUpdatedAt"      TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN "admitProfileCycleYear"      INTEGER;

-- New table: GlobalAdmitBaseline
CREATE TABLE "GlobalAdmitBaseline" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(5,4) NOT NULL,
    "source" TEXT NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "confidenceTier" TEXT NOT NULL DEFAULT 'LOW',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalAdmitBaseline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalAdmitBaseline_metric_key" ON "GlobalAdmitBaseline"("metric");
CREATE INDEX "GlobalAdmitBaseline_metric_idx" ON "GlobalAdmitBaseline"("metric");
