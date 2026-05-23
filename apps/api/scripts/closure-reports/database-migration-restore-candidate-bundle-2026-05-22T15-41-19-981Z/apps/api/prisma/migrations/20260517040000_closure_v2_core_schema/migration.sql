-- closure-v2 core schema — prediction data-collection expansion (Wave 4 + Wave 5).
-- All additions are nullable or defaulted (zero-downtime, additive only).
-- See docs/PREDICTION_CLOSURE_RERUN_PLAYBOOK.md and plan-v2.

-- CreateEnum
CREATE TYPE "ApplicantType" AS ENUM ('FRESHMAN', 'TRANSFER', 'GAP_YEAR', 'HOMESCHOOLED');

-- CreateEnum
CREATE TYPE "RecruitStatus" AS ENUM ('NONE', 'CONTACTED', 'OFFER', 'VERBAL', 'COMMITTED');

-- CreateEnum
CREATE TYPE "CnHsCategory" AS ENUM ('INTL_PRIVATE', 'INTL_PUBLIC_DEPT', 'BILINGUAL_PRIVATE', 'GAOKAO_TOP', 'GAOKAO_REGULAR', 'MIXED');

-- AlterEnum: hybrid curricula for Chinese international departments
ALTER TYPE "EducationSystem" ADD VALUE IF NOT EXISTS 'AP_AND_GAOKAO';
ALTER TYPE "EducationSystem" ADD VALUE IF NOT EXISTS 'IB_AND_GAOKAO';
ALTER TYPE "EducationSystem" ADD VALUE IF NOT EXISTS 'A_LEVEL_AND_GAOKAO';
ALTER TYPE "EducationSystem" ADD VALUE IF NOT EXISTS 'DSE';
ALTER TYPE "EducationSystem" ADD VALUE IF NOT EXISTS 'MIXED';

-- AlterTable: School — CDS-derived early-round refinements
ALTER TABLE "School"
  ADD COLUMN "yieldRate" DECIMAL(5,2),
  ADD COLUMN "ed2AcceptanceRate" DECIMAL(5,2),
  ADD COLUMN "hasRestrictiveEa" BOOLEAN;

-- AlterTable: HighSchool — curriculum + reference data + Chinese HS taxonomy
ALTER TABLE "HighSchool"
  ADD COLUMN "curriculumSystem" "EducationSystem",
  ADD COLUMN "ncesId" TEXT,
  ADD COLUMN "apOfferings" INTEGER,
  ADD COLUMN "ibOfferings" BOOLEAN,
  ADD COLUMN "classSize" INTEGER,
  ADD COLUMN "schoolProfilePdfUrl" TEXT,
  ADD COLUMN "schoolProfileExtractedFields" JSONB,
  ADD COLUMN "cnHsCategory" "CnHsCategory",
  ADD COLUMN "cnHsCityTier" INTEGER,
  ADD COLUMN "cnHsProvince" TEXT,
  ADD COLUMN "cnHsAlternativeNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "gpaConversionTable" JSONB,
  ADD COLUMN "hasGaokaoTrack" BOOLEAN,
  ADD COLUMN "hasIntlTrack" BOOLEAN,
  ADD COLUMN "intlAdmissionList" JSONB;

-- AlterTable: Profile — geo / lifecycle / recruiting context
ALTER TABLE "Profile"
  ADD COLUMN "stateOfResidence" TEXT,
  ADD COLUMN "applicationCycleYear" INTEGER,
  ADD COLUMN "applicantType" "ApplicantType",
  ADD COLUMN "recruitedSport" TEXT,
  ADD COLUMN "recruitedDivision" TEXT,
  ADD COLUMN "recruitedCoachStatus" "RecruitStatus" DEFAULT 'NONE',
  ADD COLUMN "highSchoolId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HighSchool_ncesId_key" ON "HighSchool"("ncesId");
CREATE INDEX "HighSchool_cnHsCategory_idx" ON "HighSchool"("cnHsCategory");
CREATE INDEX "HighSchool_curriculumSystem_idx" ON "HighSchool"("curriculumSystem");
CREATE INDEX "Profile_highSchoolId_idx" ON "Profile"("highSchoolId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_highSchoolId_fkey"
  FOREIGN KEY ("highSchoolId") REFERENCES "HighSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
