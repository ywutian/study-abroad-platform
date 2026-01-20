-- Essay Scraper 模块: 添加缺失的表和字段

-- AlterTable: EssayPrompt 新增字段
ALTER TABLE "EssayPrompt" ADD COLUMN "changeType" TEXT;
ALTER TABLE "EssayPrompt" ADD COLUMN "previousYearPromptId" TEXT;

-- AlterTable: EssayPromptSource 新增字段
ALTER TABLE "EssayPromptSource" ADD COLUMN "confidence" DOUBLE PRECISION;
ALTER TABLE "EssayPromptSource" ADD COLUMN "rawContent" TEXT;

-- CreateTable: SchoolEssaySource
CREATE TABLE "SchoolEssaySource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "slug" TEXT,
    "scrapeGroup" TEXT NOT NULL DEFAULT 'GENERIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastScrapedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "scrapeConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolEssaySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EssayPipelineRun
CREATE TABLE "EssayPipelineRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "totalSchools" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "newPrompts" INTEGER NOT NULL DEFAULT 0,
    "changedPrompts" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssayPipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SchoolEssaySource
CREATE INDEX "SchoolEssaySource_schoolId_idx" ON "SchoolEssaySource"("schoolId");
CREATE INDEX "SchoolEssaySource_isActive_idx" ON "SchoolEssaySource"("isActive");
CREATE INDEX "SchoolEssaySource_scrapeGroup_idx" ON "SchoolEssaySource"("scrapeGroup");
CREATE UNIQUE INDEX "SchoolEssaySource_schoolId_sourceType_key" ON "SchoolEssaySource"("schoolId", "sourceType");

-- CreateIndex: EssayPipelineRun
CREATE INDEX "EssayPipelineRun_status_idx" ON "EssayPipelineRun"("status");
CREATE INDEX "EssayPipelineRun_year_idx" ON "EssayPipelineRun"("year");
CREATE INDEX "EssayPipelineRun_startedAt_idx" ON "EssayPipelineRun"("startedAt");

-- CreateIndex: EssayPrompt
CREATE INDEX "EssayPrompt_changeType_idx" ON "EssayPrompt"("changeType");

-- AddForeignKey
ALTER TABLE "SchoolEssaySource" ADD CONSTRAINT "SchoolEssaySource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
