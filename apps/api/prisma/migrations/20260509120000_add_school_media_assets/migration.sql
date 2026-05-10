-- CreateEnum
CREATE TYPE "SchoolMediaType" AS ENUM ('LOGO', 'CAMPUS_COVER');

-- CreateEnum
CREATE TYPE "SchoolMediaStatus" AS ENUM ('CANDIDATE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SchoolMediaSourceType" AS ENUM ('OFFICIAL_WEBSITE', 'OFFICIAL_BRAND_PAGE', 'WIKIMEDIA_COMMONS', 'PUBLIC_API', 'LOGO_API', 'FAVICON_FALLBACK', 'MANUAL_ADMIN');

-- CreateTable
CREATE TABLE "SchoolMediaAsset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "SchoolMediaType" NOT NULL,
    "status" "SchoolMediaStatus" NOT NULL DEFAULT 'CANDIDATE',
    "sourceType" "SchoolMediaSourceType" NOT NULL,
    "storageUrl" TEXT,
    "originalUrl" TEXT,
    "sourcePageUrl" TEXT,
    "license" TEXT,
    "author" TEXT,
    "attribution" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "hash" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolMediaAsset_schoolId_type_status_idx" ON "SchoolMediaAsset"("schoolId", "type", "status");

-- CreateIndex
CREATE INDEX "SchoolMediaAsset_type_status_createdAt_idx" ON "SchoolMediaAsset"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolMediaAsset_hash_idx" ON "SchoolMediaAsset"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMediaAsset_one_primary_per_school_type_idx" ON "SchoolMediaAsset"("schoolId", "type") WHERE "isPrimary" = true AND "status" = 'APPROVED';

-- AddForeignKey
ALTER TABLE "SchoolMediaAsset" ADD CONSTRAINT "SchoolMediaAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
