DO $$ BEGIN
  CREATE TYPE "CompetitorRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompetitorPredictionStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'TIER_ONLY',
    'UNMATCHED',
    'AMBIGUOUS',
    'FAILED',
    'SESSION_ERROR'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BenchmarkProfile" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "profileJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BenchmarkProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompetitorSource" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "supportsNumericProbability" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitorSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompetitorRun" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "status" "CompetitorRunStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitorRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitorRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BenchmarkProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CompetitorPrediction" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "schoolKey" TEXT NOT NULL,
  "rawSchoolName" TEXT NOT NULL,
  "schoolId" TEXT,
  "matchType" TEXT,
  "probability" DECIMAL(5,4),
  "tierLabel" TEXT,
  "rawPayload" JSONB NOT NULL,
  "status" "CompetitorPredictionStatus" NOT NULL DEFAULT 'PENDING',
  "errorMsg" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitorPrediction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitorPrediction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CompetitorRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorPrediction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "BenchmarkProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorPrediction_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitorPrediction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BenchmarkProfile_createdAt_idx" ON "BenchmarkProfile"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorSource_key_key" ON "CompetitorSource"("key");
CREATE INDEX IF NOT EXISTS "CompetitorSource_enabled_idx" ON "CompetitorSource"("enabled");
CREATE INDEX IF NOT EXISTS "CompetitorRun_profileId_sourceId_idx" ON "CompetitorRun"("profileId", "sourceId");
CREATE INDEX IF NOT EXISTS "CompetitorRun_status_idx" ON "CompetitorRun"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorPrediction_runId_schoolKey_key" ON "CompetitorPrediction"("runId", "schoolKey");
CREATE INDEX IF NOT EXISTS "CompetitorPrediction_profileId_sourceId_idx" ON "CompetitorPrediction"("profileId", "sourceId");
CREATE INDEX IF NOT EXISTS "CompetitorPrediction_schoolId_idx" ON "CompetitorPrediction"("schoolId");
CREATE INDEX IF NOT EXISTS "CompetitorPrediction_status_idx" ON "CompetitorPrediction"("status");
