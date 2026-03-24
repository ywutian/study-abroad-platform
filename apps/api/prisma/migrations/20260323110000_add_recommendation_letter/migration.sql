-- CreateEnum
CREATE TYPE "RecommenderRole" AS ENUM ('TEACHER', 'COUNSELOR', 'COACH', 'EMPLOYER', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendationLetterStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "RecommendationLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommenderName" VARCHAR(200) NOT NULL,
    "recommenderEmail" VARCHAR(200),
    "recommenderRole" "RecommenderRole" NOT NULL,
    "subject" VARCHAR(200),
    "status" "RecommendationLetterStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationLetter_userId_idx" ON "RecommendationLetter"("userId");

-- AddForeignKey
ALTER TABLE "RecommendationLetter" ADD CONSTRAINT "RecommendationLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
