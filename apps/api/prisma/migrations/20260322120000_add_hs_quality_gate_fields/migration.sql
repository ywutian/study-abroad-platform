-- AlterTable: Add quality gate fields to HighSchool
ALTER TABLE "HighSchool" ADD COLUMN "qualityScore" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN "qualityGrade" TEXT;
ALTER TABLE "HighSchool" ADD COLUMN "hsImpactEnabled" BOOLEAN NOT NULL DEFAULT true;
