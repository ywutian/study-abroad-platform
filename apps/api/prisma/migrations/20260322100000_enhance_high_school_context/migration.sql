-- AlterTable
ALTER TABLE "AdmissionCase" ADD COLUMN     "highSchoolId" TEXT;

-- AlterTable
ALTER TABLE "Education" ADD COLUMN     "gpaSystem" TEXT;

-- CreateIndex
CREATE INDEX "AdmissionCase_highSchoolId_idx" ON "AdmissionCase"("highSchoolId");

-- AddForeignKey
ALTER TABLE "AdmissionCase" ADD CONSTRAINT "AdmissionCase_highSchoolId_fkey" FOREIGN KEY ("highSchoolId") REFERENCES "HighSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
