-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentContextSourceType" AS ENUM ('OFFICIAL', 'COMMUNITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RecruitmentContextModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LocationMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MatchPoolEntryType" AS ENUM ('OFFICIAL_COMPETITION', 'PROMOTED_COMMUNITY_CONTEXT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: MatchPool
CREATE TABLE IF NOT EXISTS "MatchPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RecruitmentContext
CREATE TABLE IF NOT EXISTS "RecruitmentContext" (
    "id" TEXT NOT NULL,
    "sourceType" "RecruitmentContextSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleZh" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "registrationCloseAt" TIMESTAMP(3),
    "eventStartAt" TIMESTAMP(3),
    "eventEndAt" TIMESTAMP(3),
    "locationMode" "LocationMode",
    "locationText" TEXT,
    "rolePresets" TEXT[],
    "minTeamSize" INTEGER NOT NULL,
    "maxTeamSize" INTEGER NOT NULL,
    "languages" TEXT[],
    "moderationStatus" "RecruitmentContextModerationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "competitionTrackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecruitmentContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MatchPoolEntry
CREATE TABLE IF NOT EXISTS "MatchPoolEntry" (
    "id" TEXT NOT NULL,
    "matchPoolId" TEXT NOT NULL,
    "entryType" "MatchPoolEntryType" NOT NULL,
    "competitionId" TEXT,
    "recruitmentContextId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchPoolEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable: TeamRecruitmentCard
ALTER TABLE "TeamRecruitmentCard"
  ADD COLUMN IF NOT EXISTS "recruitmentContextId" TEXT;

-- Backfill official recruitment contexts from active competition tracks
INSERT INTO "RecruitmentContext" (
    "id",
    "sourceType",
    "title",
    "titleZh",
    "subtitle",
    "description",
    "sourceUrl",
    "registrationCloseAt",
    "eventStartAt",
    "eventEndAt",
    "rolePresets",
    "minTeamSize",
    "maxTeamSize",
    "languages",
    "moderationStatus",
    "isPublished",
    "publishedAt",
    "isActive",
    "competitionTrackId",
    "createdAt",
    "updatedAt"
)
SELECT
    'rctx_' || substr(md5(ct."id" || c."id"), 1, 24),
    'OFFICIAL'::"RecruitmentContextSourceType",
    c."name",
    c."nameZh",
    c."abbreviation" || ' · ' || ct."name" || ' · ' || ce."seasonLabel",
    COALESCE(c."description", ct."name"),
    c."website",
    ce."registrationCloseAt",
    ce."eventStartAt",
    ce."eventEndAt",
    ct."rolePresets",
    ct."minTeamSize",
    ct."maxTeamSize",
    ct."languages",
    'APPROVED'::"RecruitmentContextModerationStatus",
    true,
    CURRENT_TIMESTAMP,
    ct."isActive",
    ct."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "CompetitionTrack" ct
INNER JOIN "CompetitionEdition" ce ON ce."id" = ct."competitionEditionId"
INNER JOIN "Competition" c ON c."id" = ce."competitionId"
LEFT JOIN "RecruitmentContext" rc ON rc."competitionTrackId" = ct."id"
WHERE rc."id" IS NULL;

-- Backfill recruitment context ids onto existing recruitment cards
UPDATE "TeamRecruitmentCard" trc
SET "recruitmentContextId" = rc."id"
FROM "RecruitmentContext" rc
WHERE rc."competitionTrackId" = trc."competitionTrackId"
  AND trc."recruitmentContextId" IS NULL;

ALTER TABLE "TeamRecruitmentCard"
  ALTER COLUMN "recruitmentContextId" SET NOT NULL;

-- Drop old track binding once data is migrated
DO $$ BEGIN
  ALTER TABLE "TeamRecruitmentCard" DROP CONSTRAINT "TeamRecruitmentCard_competitionTrackId_fkey";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "TeamRecruitmentCard_teamId_competitionTrackId_key";
ALTER TABLE "TeamRecruitmentCard" DROP COLUMN IF EXISTS "competitionTrackId";

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "RecruitmentContext_competitionTrackId_key" ON "RecruitmentContext"("competitionTrackId");
CREATE INDEX IF NOT EXISTS "RecruitmentContext_sourceType_isPublished_isActive_idx" ON "RecruitmentContext"("sourceType", "isPublished", "isActive");
CREATE INDEX IF NOT EXISTS "RecruitmentContext_createdById_updatedAt_idx" ON "RecruitmentContext"("createdById", "updatedAt");
CREATE INDEX IF NOT EXISTS "RecruitmentContext_moderationStatus_updatedAt_idx" ON "RecruitmentContext"("moderationStatus", "updatedAt");
CREATE INDEX IF NOT EXISTS "MatchPool_isActive_sortOrder_idx" ON "MatchPool"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "MatchPoolEntry_matchPoolId_isActive_sortOrder_idx" ON "MatchPoolEntry"("matchPoolId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "MatchPoolEntry_competitionId_idx" ON "MatchPoolEntry"("competitionId");
CREATE INDEX IF NOT EXISTS "MatchPoolEntry_recruitmentContextId_idx" ON "MatchPoolEntry"("recruitmentContextId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamRecruitmentCard_teamId_recruitmentContextId_key" ON "TeamRecruitmentCard"("teamId", "recruitmentContextId");

-- Seed a default public pool for popular official competitions when contexts exist
INSERT INTO "MatchPool" (
    "id",
    "name",
    "nameZh",
    "description",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'pool_' || substr(md5('popular-main-competitions'), 1, 24),
    'Popular Main Competitions',
    '热门主流比赛',
    'Official public-sector competitions curated for quick teammate discovery.',
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM "MatchPool"
    WHERE "name" = 'Popular Main Competitions'
);

INSERT INTO "MatchPoolEntry" (
    "id",
    "matchPoolId",
    "entryType",
    "competitionId",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'mpe_' || substr(md5('popular-main-competitions:' || c."id"), 1, 24),
    pool."id",
    'OFFICIAL_COMPETITION'::"MatchPoolEntryType",
    c."id",
    featured."sortOrder",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    VALUES
      ('NEC', 0),
      ('BPA', 1),
      ('NSDA Nationals', 2),
      ('NSDA China', 3)
) AS featured("abbreviation", "sortOrder")
INNER JOIN "Competition" c ON c."abbreviation" = featured."abbreviation"
INNER JOIN "MatchPool" pool
  ON pool."name" = 'Popular Main Competitions'
LEFT JOIN "MatchPoolEntry" existing
  ON existing."matchPoolId" = pool."id"
 AND existing."competitionId" = c."id"
WHERE existing."id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "RecruitmentContext" rc
    INNER JOIN "CompetitionTrack" ct ON ct."id" = rc."competitionTrackId"
    INNER JOIN "CompetitionEdition" ce ON ce."id" = ct."competitionEditionId"
    WHERE rc."sourceType" = 'OFFICIAL'::"RecruitmentContextSourceType"
      AND rc."isPublished" = true
      AND rc."isActive" = true
      AND ce."competitionId" = c."id"
  );

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "RecruitmentContext" ADD CONSTRAINT "RecruitmentContext_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RecruitmentContext" ADD CONSTRAINT "RecruitmentContext_competitionTrackId_fkey"
    FOREIGN KEY ("competitionTrackId") REFERENCES "CompetitionTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MatchPoolEntry" ADD CONSTRAINT "MatchPoolEntry_matchPoolId_fkey"
    FOREIGN KEY ("matchPoolId") REFERENCES "MatchPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MatchPoolEntry" ADD CONSTRAINT "MatchPoolEntry_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MatchPoolEntry" ADD CONSTRAINT "MatchPoolEntry_recruitmentContextId_fkey"
    FOREIGN KEY ("recruitmentContextId") REFERENCES "RecruitmentContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamRecruitmentCard" ADD CONSTRAINT "TeamRecruitmentCard_recruitmentContextId_fkey"
    FOREIGN KEY ("recruitmentContextId") REFERENCES "RecruitmentContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
