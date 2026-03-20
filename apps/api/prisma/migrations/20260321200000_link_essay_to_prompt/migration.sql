-- AlterTable
ALTER TABLE "Essay" ADD COLUMN "essayPromptId" TEXT;

-- CreateIndex
CREATE INDEX "Essay_essayPromptId_idx" ON "Essay"("essayPromptId");

-- AddForeignKey
ALTER TABLE "Essay" ADD CONSTRAINT "Essay_essayPromptId_fkey" FOREIGN KEY ("essayPromptId") REFERENCES "EssayPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
