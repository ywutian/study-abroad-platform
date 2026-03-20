-- AlterTable: AdmissionCase — add structured enrichment fields

-- Structured test scores (preferred over range strings)
ALTER TABLE "AdmissionCase" ADD COLUMN "testScores" JSONB;
ALTER TABLE "AdmissionCase" ADD COLUMN "apCount" INTEGER;
ALTER TABLE "AdmissionCase" ADD COLUMN "apSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AdmissionCase" ADD COLUMN "ibScore" INTEGER;
ALTER TABLE "AdmissionCase" ADD COLUMN "ibPredicted" BOOLEAN;

-- Structured extracurriculars & awards (JSON arrays)
ALTER TABLE "AdmissionCase" ADD COLUMN "activities" JSONB;
ALTER TABLE "AdmissionCase" ADD COLUMN "awards" JSONB;

-- Student background
ALTER TABLE "AdmissionCase" ADD COLUMN "highSchoolType" "HighSchoolType";
ALTER TABLE "AdmissionCase" ADD COLUMN "curriculumType" "EducationSystem";
ALTER TABLE "AdmissionCase" ADD COLUMN "demographicTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Application context
ALTER TABLE "AdmissionCase" ADD COLUMN "financialAid" TEXT;
ALTER TABLE "AdmissionCase" ADD COLUMN "enrollmentStatus" TEXT;
ALTER TABLE "AdmissionCase" ADD COLUMN "narrative" TEXT;
