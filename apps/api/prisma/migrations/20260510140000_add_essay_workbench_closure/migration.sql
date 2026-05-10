CREATE TABLE "EssayRevision" (
    "id" TEXT NOT NULL,
    "essayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EssayRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EssaySuggestion" (
    "id" TEXT NOT NULL,
    "essayId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rewrite',
    "originalText" TEXT,
    "replacementText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "insertMode" TEXT NOT NULL DEFAULT 'replace',
    "createdFromRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EssaySuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EssayRevision_essayId_idx" ON "EssayRevision"("essayId");
CREATE INDEX "EssayRevision_createdAt_idx" ON "EssayRevision"("createdAt");
CREATE INDEX "EssaySuggestion_essayId_idx" ON "EssaySuggestion"("essayId");
CREATE INDEX "EssaySuggestion_status_idx" ON "EssaySuggestion"("status");
CREATE INDEX "EssaySuggestion_createdFromRevisionId_idx" ON "EssaySuggestion"("createdFromRevisionId");

ALTER TABLE "EssayRevision" ADD CONSTRAINT "EssayRevision_essayId_fkey" FOREIGN KEY ("essayId") REFERENCES "Essay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EssaySuggestion" ADD CONSTRAINT "EssaySuggestion_essayId_fkey" FOREIGN KEY ("essayId") REFERENCES "Essay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EssaySuggestion" ADD CONSTRAINT "EssaySuggestion_createdFromRevisionId_fkey" FOREIGN KEY ("createdFromRevisionId") REFERENCES "EssayRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
