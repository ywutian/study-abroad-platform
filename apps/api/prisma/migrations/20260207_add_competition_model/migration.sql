-- CreateEnum
CREATE TYPE "CompetitionCategory" AS ENUM ('MATH', 'BIOLOGY', 'PHYSICS', 'CHEMISTRY', 'COMPUTER_SCIENCE', 'ENGINEERING_RESEARCH', 'ECONOMICS_BUSINESS', 'DEBATE_SPEECH', 'WRITING_ESSAY', 'GENERAL_ACADEMIC', 'ARTS_MUSIC', 'OTHER');

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "nameZh" TEXT,
    "category" "CompetitionCategory" NOT NULL,
    "level" "AwardLevel" NOT NULL,
    "tier" INTEGER NOT NULL,
    "description" TEXT,
    "descriptionZh" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_abbreviation_key" ON "Competition"("abbreviation");

-- CreateIndex
CREATE INDEX "Competition_category_idx" ON "Competition"("category");

-- CreateIndex
CREATE INDEX "Competition_tier_idx" ON "Competition"("tier");

-- AlterTable: Add competitionId to Award
ALTER TABLE "Award" ADD COLUMN "competitionId" TEXT;

-- CreateIndex
CREATE INDEX "Award_competitionId_idx" ON "Award"("competitionId");

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
