-- CreateEnum
CREATE TYPE "DistillationCoverageTier" AS ENUM ('NONE', 'BASELINE_ONLY', 'CN_ENHANCED');

-- CreateTable
CREATE TABLE "DistillationDailyAggregate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "stage" TEXT NOT NULL,
    "teacherKey" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "selectivityBand" TEXT,
    "predictionCount" INTEGER NOT NULL DEFAULT 0,
    "activeSignalCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedOutcomeCount" INTEGER NOT NULL DEFAULT 0,
    "avgTeacherProbability" DECIMAL(6,4),
    "avgObservedWeight" DECIMAL(6,4),
    "avgBlendDelta" DECIMAL(6,4),
    "avgAbsBlendDelta" DECIMAL(6,4),
    "brierTeacher" DECIMAL(8,6),
    "brierBlended" DECIMAL(8,6),
    "brierServed" DECIMAL(8,6),
    "distinctSchoolCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistillationDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistillationSchoolDailyAggregate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "predictionCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedOutcomeCount" INTEGER NOT NULL DEFAULT 0,
    "coverageTier" "DistillationCoverageTier" NOT NULL DEFAULT 'NONE',
    "activeTeacherKeys" TEXT[],
    "avgBlendDelta" DECIMAL(6,4),
    "avgAbsBlendDelta" DECIMAL(6,4),
    "brierBlended" DECIMAL(8,6),
    "brierServed" DECIMAL(8,6),
    "lastObservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistillationSchoolDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistillationDailyAggregate_date_stage_teacherKey_cohortKey_key" ON "DistillationDailyAggregate"("date", "stage", "teacherKey", "cohortKey", "selectivityBand");

-- CreateIndex
CREATE INDEX "DistillationDailyAggregate_date_stage_idx" ON "DistillationDailyAggregate"("date", "stage");

-- CreateIndex
CREATE INDEX "DistillationDailyAggregate_teacherKey_date_idx" ON "DistillationDailyAggregate"("teacherKey", "date");

-- CreateIndex
CREATE INDEX "DistillationDailyAggregate_cohortKey_date_idx" ON "DistillationDailyAggregate"("cohortKey", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DistillationSchoolDailyAggregate_date_schoolId_cohortKey_stag_key" ON "DistillationSchoolDailyAggregate"("date", "schoolId", "cohortKey", "stage");

-- CreateIndex
CREATE INDEX "DistillationSchoolDailyAggregate_date_stage_idx" ON "DistillationSchoolDailyAggregate"("date", "stage");

-- CreateIndex
CREATE INDEX "DistillationSchoolDailyAggregate_schoolId_date_idx" ON "DistillationSchoolDailyAggregate"("schoolId", "date");

-- CreateIndex
CREATE INDEX "DistillationSchoolDailyAggregate_cohortKey_date_idx" ON "DistillationSchoolDailyAggregate"("cohortKey", "date");

-- AddForeignKey
ALTER TABLE "DistillationSchoolDailyAggregate" ADD CONSTRAINT "DistillationSchoolDailyAggregate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
