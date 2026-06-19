-- Formal launch of personalized AI tools for the public essay gallery.
-- Fixed learning notes stay free/read-only; personalized ask/compare flows
-- are now persisted for history, feedback, workbench recall, and metrics.

CREATE TABLE "GalleryEssayAIInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "admissionCaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "locale" TEXT NOT NULL DEFAULT 'zh',
    "question" TEXT,
    "paragraphIndex" INTEGER,
    "selectedText" TEXT,
    "focus" TEXT,
    "clientRequestId" TEXT,
    "userEssayId" TEXT,
    "essayAIResultId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "evidence" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "pointsAction" TEXT,
    "pointsCharged" INTEGER,
    "pointsHistoryId" TEXT,
    "refundPointHistoryId" TEXT,
    "refundStatus" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryEssayAIInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryEssayAIInteractionFeedback" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryEssayAIInteractionFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GalleryEssayAIInteraction_userId_admissionCaseId_createdAt_idx" ON "GalleryEssayAIInteraction"("userId", "admissionCaseId", "createdAt");
CREATE INDEX "GalleryEssayAIInteraction_userId_type_createdAt_idx" ON "GalleryEssayAIInteraction"("userId", "type", "createdAt");
CREATE INDEX "GalleryEssayAIInteraction_admissionCaseId_type_createdAt_idx" ON "GalleryEssayAIInteraction"("admissionCaseId", "type", "createdAt");
CREATE INDEX "GalleryEssayAIInteraction_status_createdAt_idx" ON "GalleryEssayAIInteraction"("status", "createdAt");
CREATE INDEX "GalleryEssayAIInteraction_userEssayId_createdAt_idx" ON "GalleryEssayAIInteraction"("userEssayId", "createdAt");
CREATE INDEX "GalleryEssayAIInteraction_essayAIResultId_idx" ON "GalleryEssayAIInteraction"("essayAIResultId");
CREATE INDEX "GalleryEssayAIInteraction_pointsHistoryId_idx" ON "GalleryEssayAIInteraction"("pointsHistoryId");
CREATE INDEX "GalleryEssayAIInteraction_refundPointHistoryId_idx" ON "GalleryEssayAIInteraction"("refundPointHistoryId");
CREATE UNIQUE INDEX "GalleryEssayAIInteraction_userId_admissionCaseId_type_clientRequestId_key" ON "GalleryEssayAIInteraction"("userId", "admissionCaseId", "type", "clientRequestId");

CREATE UNIQUE INDEX "GalleryEssayAIInteractionFeedback_interactionId_key" ON "GalleryEssayAIInteractionFeedback"("interactionId");
CREATE INDEX "GalleryEssayAIInteractionFeedback_userId_createdAt_idx" ON "GalleryEssayAIInteractionFeedback"("userId", "createdAt");
CREATE INDEX "GalleryEssayAIInteractionFeedback_sentiment_createdAt_idx" ON "GalleryEssayAIInteractionFeedback"("sentiment", "createdAt");
CREATE INDEX "GalleryEssayAIInteractionFeedback_category_createdAt_idx" ON "GalleryEssayAIInteractionFeedback"("category", "createdAt");

ALTER TABLE "GalleryEssayAIInteraction" ADD CONSTRAINT "GalleryEssayAIInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalleryEssayAIInteraction" ADD CONSTRAINT "GalleryEssayAIInteraction_admissionCaseId_fkey" FOREIGN KEY ("admissionCaseId") REFERENCES "AdmissionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalleryEssayAIInteraction" ADD CONSTRAINT "GalleryEssayAIInteraction_userEssayId_fkey" FOREIGN KEY ("userEssayId") REFERENCES "Essay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GalleryEssayAIInteraction" ADD CONSTRAINT "GalleryEssayAIInteraction_essayAIResultId_fkey" FOREIGN KEY ("essayAIResultId") REFERENCES "EssayAIResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GalleryEssayAIInteraction" ADD CONSTRAINT "GalleryEssayAIInteraction_pointsHistoryId_fkey" FOREIGN KEY ("pointsHistoryId") REFERENCES "PointHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GalleryEssayAIInteraction" ADD CONSTRAINT "GalleryEssayAIInteraction_refundPointHistoryId_fkey" FOREIGN KEY ("refundPointHistoryId") REFERENCES "PointHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GalleryEssayAIInteractionFeedback" ADD CONSTRAINT "GalleryEssayAIInteractionFeedback_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "GalleryEssayAIInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalleryEssayAIInteractionFeedback" ADD CONSTRAINT "GalleryEssayAIInteractionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "feature_flags" ("id", "key", "enabled", "description", "rules", "createdAt", "updatedAt")
VALUES (
    'ff_essay_gallery_personalized_tools_v1',
    'essay_gallery_personalized_tools_v1',
    true,
    'Emergency kill switch for personalized public essay gallery ask/compare tools. Enabled globally for formal launch.',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
