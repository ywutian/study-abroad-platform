-- 锐评模式重构迁移
-- 1. Review 模型: essayScore → testScore, 新增 awardScore/按模块评语/状态/标签/互动
-- 2. 新增 ReviewReaction 模型
-- 3. 新增 ReviewStatus 枚举

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- AlterTable: Review 新增字段
-- 重命名 essayScore → testScore (语义修正: 标化成绩而非文书)
ALTER TABLE "Review" RENAME COLUMN "essayScore" TO "testScore";

-- 新增奖项评分维度
ALTER TABLE "Review" ADD COLUMN "awardScore" INTEGER NOT NULL DEFAULT 5;

-- 新增按模块评语
ALTER TABLE "Review" ADD COLUMN "academicComment" TEXT;
ALTER TABLE "Review" ADD COLUMN "testComment" TEXT;
ALTER TABLE "Review" ADD COLUMN "activityComment" TEXT;
ALTER TABLE "Review" ADD COLUMN "awardComment" TEXT;

-- 新增元数据字段
ALTER TABLE "Review" ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Review" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Review" ADD COLUMN "helpfulCount" INTEGER NOT NULL DEFAULT 0;

-- 删除旧索引并创建新索引
DROP INDEX IF EXISTS "Review_profileUserId_idx";
CREATE INDEX "Review_profileUserId_status_createdAt_idx" ON "Review"("profileUserId", "status", "createdAt");

-- CreateTable: ReviewReaction
CREATE TABLE "ReviewReaction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReaction_reviewId_userId_type_key" ON "ReviewReaction"("reviewId", "userId", "type");
CREATE INDEX "ReviewReaction_reviewId_idx" ON "ReviewReaction"("reviewId");

-- AddForeignKey
ALTER TABLE "ReviewReaction" ADD CONSTRAINT "ReviewReaction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReaction" ADD CONSTRAINT "ReviewReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
