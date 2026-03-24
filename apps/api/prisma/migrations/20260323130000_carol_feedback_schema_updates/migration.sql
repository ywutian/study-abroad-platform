-- AlterEnum: Add IGCSE to TestType
ALTER TYPE "TestType" ADD VALUE 'IGCSE';

-- CreateEnum: AwardCategory
CREATE TYPE "AwardCategory" AS ENUM ('STEM', 'MATH', 'SCIENCE', 'COMPUTER_SCIENCE', 'ENGINEERING', 'BUSINESS', 'ARTS', 'HUMANITIES', 'SOCIAL_SCIENCE', 'LANGUAGE', 'SPORTS', 'COMMUNITY_SERVICE', 'LEADERSHIP', 'OTHER');

-- AlterTable: Profile - widen GPA precision and add grade-level GPAs
ALTER TABLE "Profile" ALTER COLUMN "gpa" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "Profile" ALTER COLUMN "gpaScale" SET DATA TYPE DECIMAL(5,2);
ALTER TABLE "Profile" ADD COLUMN "gpa9" DECIMAL(5,2);
ALTER TABLE "Profile" ADD COLUMN "gpa10" DECIMAL(5,2);
ALTER TABLE "Profile" ADD COLUMN "gpa11" DECIMAL(5,2);
ALTER TABLE "Profile" ADD COLUMN "gpa12" DECIMAL(5,2);

-- CreateTable: SemesterGpa
CREATE TABLE "SemesterGpa" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "gpa" DECIMAL(5,2) NOT NULL,
    "gpaScale" DECIMAL(5,2) NOT NULL DEFAULT 4.0,
    "credits" DECIMAL(5,1),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemesterGpa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SemesterGpa
CREATE INDEX "SemesterGpa_profileId_idx" ON "SemesterGpa"("profileId");
CREATE UNIQUE INDEX "SemesterGpa_profileId_semester_year_key" ON "SemesterGpa"("profileId", "semester", "year");

-- AddForeignKey: SemesterGpa -> Profile
ALTER TABLE "SemesterGpa" ADD CONSTRAINT "SemesterGpa_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Award - add category
ALTER TABLE "Award" ADD COLUMN "category" "AwardCategory";

-- CreateIndex: Award category
CREATE INDEX "Award_category_idx" ON "Award"("category");

-- AlterTable: Activity - add commonAppDescription
ALTER TABLE "Activity" ADD COLUMN "commonAppDescription" VARCHAR(150);

-- AlterTable: School - add transferAcceptanceRate
ALTER TABLE "School" ADD COLUMN "transferAcceptanceRate" DECIMAL(5,2);

-- AlterTable: SchoolRanking - add sourceUrl
ALTER TABLE "SchoolRanking" ADD COLUMN "sourceUrl" TEXT;
