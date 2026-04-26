-- CreateTable
CREATE TABLE "SchoolCdsAdmitBand" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gpaBand" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "testBand" TEXT NOT NULL,
    "admitRate" DECIMAL(6,4) NOT NULL,
    "sampleCount" INTEGER,
    "cycleYear" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCdsAdmitBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCdsAdmitBand_schoolId_gpaBand_testType_testBand_cycle_key" ON "SchoolCdsAdmitBand"("schoolId", "gpaBand", "testType", "testBand", "cycleYear");

-- CreateIndex
CREATE INDEX "SchoolCdsAdmitBand_schoolId_gpaBand_testType_testBand_idx" ON "SchoolCdsAdmitBand"("schoolId", "gpaBand", "testType", "testBand");

-- AddForeignKey
ALTER TABLE "SchoolCdsAdmitBand" ADD CONSTRAINT "SchoolCdsAdmitBand_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
