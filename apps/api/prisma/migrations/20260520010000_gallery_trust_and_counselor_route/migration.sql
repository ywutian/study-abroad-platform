-- Gallery trust signal + counselor route + workbench attribution (PR 2)
--
-- All additions are nullable; ADD VALUE on the enum is forward-only.
-- Zero-downtime — old API revisions ignore the new columns and a missing
-- COUNSELOR enum value never occurs at write-time because writes are
-- gated by the new role-checked endpoints.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COUNSELOR';

-- AlterTable
ALTER TABLE "AdmissionCase" ADD COLUMN     "selfReflection" TEXT,
ADD COLUMN     "sourceArchive" TEXT,
ADD COLUMN     "sourceAuthor" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "Essay" ADD COLUMN     "inspirationCaseId" TEXT;

-- CreateIndex
CREATE INDEX "Essay_inspirationCaseId_idx" ON "Essay"("inspirationCaseId");

-- AddForeignKey
ALTER TABLE "Essay" ADD CONSTRAINT "Essay_inspirationCaseId_fkey" FOREIGN KEY ("inspirationCaseId") REFERENCES "AdmissionCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
