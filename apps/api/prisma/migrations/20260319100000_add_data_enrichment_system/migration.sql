-- CreateEnum
CREATE TYPE "DataReviewStatus" AS ENUM ('AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StagingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('CASE', 'SCHOOL', 'ESSAY_PROMPT');

-- AlterEnum (add OPERATOR and SUPER_ADMIN to Role)
-- Use rename-and-recreate pattern to avoid "unsafe use of new enum value" in shadow DB
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('USER', 'VERIFIED', 'ADMIN', 'OPERATOR', 'SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
-- Also update any other columns using Role enum
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RolePermission' AND column_name = 'role') THEN
    ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
  END IF;
END $$;
DROP TYPE "Role_old";

-- AlterTable: AdmissionCase — add data enrichment fields
ALTER TABLE "AdmissionCase" ADD COLUMN "qualityScore" INTEGER DEFAULT 0;
ALTER TABLE "AdmissionCase" ADD COLUMN "reviewStatus" "DataReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "AdmissionCase" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "AdmissionCase" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "AdmissionCase" ADD COLUMN "source" TEXT;
ALTER TABLE "AdmissionCase" ADD COLUMN "importBatchId" TEXT;

-- AlterTable: School — add data review tracking
ALTER TABLE "School" ADD COLUMN "lastDataReviewAt" TIMESTAMP(3);
ALTER TABLE "School" ADD COLUMN "dataReviewStatus" "DataReviewStatus" NOT NULL DEFAULT 'AUTO_APPROVED';

-- AlterTable: EssayPrompt — add import batch ID
ALTER TABLE "EssayPrompt" ADD COLUMN "importBatchId" TEXT;

-- CreateTable: RolePermission
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OperatorInvite
CREATE TABLE "OperatorInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "createdBy" TEXT NOT NULL,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DataImportStaging
CREATE TABLE "DataImportStaging" (
    "id" TEXT NOT NULL,
    "dataType" "DataType" NOT NULL,
    "source" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "status" "StagingStatus" NOT NULL DEFAULT 'PENDING',
    "importBatchId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "mergedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataImportStaging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

CREATE UNIQUE INDEX "OperatorInvite_token_key" ON "OperatorInvite"("token");
CREATE INDEX "OperatorInvite_token_idx" ON "OperatorInvite"("token");
CREATE INDEX "OperatorInvite_expiresAt_idx" ON "OperatorInvite"("expiresAt");

CREATE INDEX "DataImportStaging_dataType_idx" ON "DataImportStaging"("dataType");
CREATE INDEX "DataImportStaging_status_idx" ON "DataImportStaging"("status");
CREATE INDEX "DataImportStaging_importBatchId_idx" ON "DataImportStaging"("importBatchId");
CREATE INDEX "DataImportStaging_source_idx" ON "DataImportStaging"("source");
CREATE INDEX "DataImportStaging_createdAt_idx" ON "DataImportStaging"("createdAt");

CREATE INDEX "AdmissionCase_reviewStatus_idx" ON "AdmissionCase"("reviewStatus");
CREATE INDEX "AdmissionCase_importBatchId_idx" ON "AdmissionCase"("importBatchId");

-- Backfill existing AdmissionCase records to AUTO_APPROVED
UPDATE "AdmissionCase" SET "reviewStatus" = 'AUTO_APPROVED', "source" = 'legacy' WHERE "reviewStatus" = 'PENDING_REVIEW';
