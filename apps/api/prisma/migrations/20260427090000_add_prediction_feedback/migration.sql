-- CreateEnum
CREATE TYPE "PredictionFeedbackSentiment" AS ENUM ('POSITIVE', 'UNSURE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "PredictionFeedbackCategory" AS ENUM ('TOO_HIGH', 'TOO_LOW', 'FACTORS_WRONG', 'NEVER_MOVES', 'OTHER');

-- CreateTable
CREATE TABLE "PredictionFeedback" (
    "id" TEXT NOT NULL,
    "predictionResultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentiment" "PredictionFeedbackSentiment" NOT NULL,
    "category" "PredictionFeedbackCategory",
    "notes" TEXT,
    "engineSnapshot" TEXT,
    "probabilitySnapshot" DECIMAL(6,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PredictionFeedback_predictionResultId_userId_key" ON "PredictionFeedback"("predictionResultId", "userId");

-- CreateIndex
CREATE INDEX "PredictionFeedback_sentiment_createdAt_idx" ON "PredictionFeedback"("sentiment", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionFeedback_engineSnapshot_createdAt_idx" ON "PredictionFeedback"("engineSnapshot", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionFeedback_userId_createdAt_idx" ON "PredictionFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PredictionFeedback_category_createdAt_idx" ON "PredictionFeedback"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "PredictionFeedback" ADD CONSTRAINT "PredictionFeedback_predictionResultId_fkey" FOREIGN KEY ("predictionResultId") REFERENCES "PredictionResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionFeedback" ADD CONSTRAINT "PredictionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
