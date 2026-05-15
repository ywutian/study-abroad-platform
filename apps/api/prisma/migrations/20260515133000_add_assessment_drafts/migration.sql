CREATE TABLE IF NOT EXISTS "AssessmentDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AssessmentType" NOT NULL,
  "answers" JSONB NOT NULL,
  "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssessmentDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentDraft_userId_type_key" ON "AssessmentDraft"("userId", "type");
CREATE INDEX IF NOT EXISTS "AssessmentDraft_userId_idx" ON "AssessmentDraft"("userId");
CREATE INDEX IF NOT EXISTS "AssessmentDraft_expiresAt_idx" ON "AssessmentDraft"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "AssessmentDraft"
    ADD CONSTRAINT "AssessmentDraft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
