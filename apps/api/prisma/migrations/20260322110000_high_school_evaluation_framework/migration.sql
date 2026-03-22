-- AlterTable: HighSchool evaluation dimensions
ALTER TABLE "HighSchool" ADD COLUMN     "recognition" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "academicRigor" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "placementRecord" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "studentQuality" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "resources" INTEGER;

-- AlterTable: HighSchool evaluation metadata
ALTER TABLE "HighSchool" ADD COLUMN     "evaluatedAt" TIMESTAMP(3);
ALTER TABLE "HighSchool" ADD COLUMN     "evaluatedBy" TEXT;
ALTER TABLE "HighSchool" ADD COLUMN     "evaluationNotes" TEXT;

-- AlterTable: HighSchool supplementary data
ALTER TABLE "HighSchool" ADD COLUMN     "avgSatScore" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "avgIbScore" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "annualTop30Count" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "annualApplicants" INTEGER;
ALTER TABLE "HighSchool" ADD COLUMN     "gradeInflation" TEXT;
ALTER TABLE "HighSchool" ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "HighSchoolSuggestion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "submittedBy" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mergedInto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HighSchoolSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HighSchoolSuggestion_name_country_key" ON "HighSchoolSuggestion"("name", "country");

-- CreateIndex
CREATE INDEX "HighSchoolSuggestion_status_idx" ON "HighSchoolSuggestion"("status");
