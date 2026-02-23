-- AlterTable: Add source column to PredictionResult
ALTER TABLE "PredictionResult" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- CreateTable: PredictionSnapshot for prediction history tracking
CREATE TABLE IF NOT EXISTS "PredictionSnapshot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "probabilityLow" DECIMAL(5,4),
    "probabilityHigh" DECIMAL(5,4),
    "tier" TEXT,
    "confidence" TEXT,
    "source" TEXT NOT NULL DEFAULT 'prediction',
    "modelVersion" TEXT NOT NULL DEFAULT 'v2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_profileId_schoolId_createdAt_idx" ON "PredictionSnapshot"("profileId", "schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_profileId_createdAt_idx" ON "PredictionSnapshot"("profileId", "createdAt");
