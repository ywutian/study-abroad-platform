-- CreateEnum
CREATE TYPE "SchoolRecommendationEventType" AS ENUM ('IMPRESSION', 'ADDED', 'REMOVED', 'APPLIED');

-- AlterTable
ALTER TABLE "SchoolListItem" ADD COLUMN "sourceRecommendationId" TEXT;

-- CreateTable
CREATE TABLE "SchoolRecommendationEvent" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolListItemId" TEXT,
    "eventType" "SchoolRecommendationEventType" NOT NULL,
    "position" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolRecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolListItem_sourceRecommendationId_idx" ON "SchoolListItem"("sourceRecommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolRecommendationEvent_recommendationId_schoolId_eventType_key" ON "SchoolRecommendationEvent"("recommendationId", "schoolId", "eventType");

-- CreateIndex
CREATE INDEX "SchoolRecommendationEvent_userId_eventType_createdAt_idx" ON "SchoolRecommendationEvent"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolRecommendationEvent_schoolId_eventType_createdAt_idx" ON "SchoolRecommendationEvent"("schoolId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolRecommendationEvent_schoolListItemId_idx" ON "SchoolRecommendationEvent"("schoolListItemId");

-- AddForeignKey
ALTER TABLE "SchoolListItem" ADD CONSTRAINT "SchoolListItem_sourceRecommendationId_fkey" FOREIGN KEY ("sourceRecommendationId") REFERENCES "SchoolRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolRecommendationEvent" ADD CONSTRAINT "SchoolRecommendationEvent_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "SchoolRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolRecommendationEvent" ADD CONSTRAINT "SchoolRecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolRecommendationEvent" ADD CONSTRAINT "SchoolRecommendationEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolRecommendationEvent" ADD CONSTRAINT "SchoolRecommendationEvent_schoolListItemId_fkey" FOREIGN KEY ("schoolListItemId") REFERENCES "SchoolListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
