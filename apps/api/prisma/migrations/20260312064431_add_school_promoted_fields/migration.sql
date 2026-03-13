-- AlterTable
ALTER TABLE "School" ADD COLUMN     "acceptsCoalition" BOOLEAN,
ADD COLUMN     "acceptsCommonApp" BOOLEAN,
ADD COLUMN     "applicationFee" INTEGER,
ADD COLUMN     "averageAidPackage" INTEGER,
ADD COLUMN     "averageNetPrice" INTEGER,
ADD COLUMN     "countriesRepresented" INTEGER,
ADD COLUMN     "feeWaiverAvailable" BOOLEAN,
ADD COLUMN     "hasEarlyDecision" BOOLEAN,
ADD COLUMN     "loanDefaultRate" DECIMAL(5,2),
ADD COLUMN     "monthlyLoanPayment" INTEGER,
ADD COLUMN     "percentNeedMet" DECIMAL(5,2),
ADD COLUMN     "retentionRate" DECIMAL(5,2),
ADD COLUMN     "roomAndBoard" INTEGER,
ADD COLUMN     "salary6YrPostGrad" INTEGER,
ADD COLUMN     "studentFacultyRatio" INTEGER,
ADD COLUMN     "studentOrgsCount" INTEGER,
ADD COLUMN     "testOptional" BOOLEAN;

-- CreateIndex
CREATE INDEX "School_testOptional_idx" ON "School"("testOptional");

-- CreateIndex
CREATE INDEX "School_hasEarlyDecision_idx" ON "School"("hasEarlyDecision");
