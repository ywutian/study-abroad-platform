DO $$ BEGIN
  CREATE TYPE "StaticTeacherSnapshotStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "BenchmarkProfile"
ADD COLUMN IF NOT EXISTS "cohortTag" TEXT;

CREATE TABLE IF NOT EXISTS "StaticTeacherSnapshot" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "slug" TEXT,
  "lookupJson" JSONB NOT NULL,
  "status" "StaticTeacherSnapshotStatus" NOT NULL DEFAULT 'PENDING',
  "errorMsg" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaticTeacherSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaticTeacherSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StaticTeacherSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BenchmarkProfile_cohortTag_label_idx"
ON "BenchmarkProfile"("cohortTag", "label");

CREATE UNIQUE INDEX IF NOT EXISTS "StaticTeacherSnapshot_sourceId_schoolId_key"
ON "StaticTeacherSnapshot"("sourceId", "schoolId");

CREATE INDEX IF NOT EXISTS "StaticTeacherSnapshot_status_idx"
ON "StaticTeacherSnapshot"("status");

CREATE INDEX IF NOT EXISTS "StaticTeacherSnapshot_sourceId_fetchedAt_idx"
ON "StaticTeacherSnapshot"("sourceId", "fetchedAt");
