-- DropIndex
DROP INDEX IF EXISTS "ForumPost_content_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "ForumPost_title_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "Memory_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "AdmissionCase" ALTER COLUMN "apSubjects" DROP DEFAULT,
ALTER COLUMN "demographicTags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AssessmentResult" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: Block - add updatedAt (use default for existing rows, then drop default)
ALTER TABLE "Block" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Block" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: ConversationParticipant
ALTER TABLE "ConversationParticipant" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ConversationParticipant" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DataImportStaging" ADD COLUMN "createdBy" TEXT;

-- AlterTable: EssayAIResult
ALTER TABLE "EssayAIResult" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EssayAIResult" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EssayPromptSource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Follow" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PredictionSnapshot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: ProfileTargetSchool
ALTER TABLE "ProfileTargetSchool" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProfileTargetSchool" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: Report
ALTER TABLE "Report" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Report" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: ResumeAIReview
ALTER TABLE "ResumeAIReview" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ResumeAIReview" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: ResumeSnapshot
ALTER TABLE "ResumeSnapshot" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ResumeSnapshot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SchoolMetric" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: SchoolRecommendation
ALTER TABLE "SchoolRecommendation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SchoolRecommendation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SwipeStats" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: TeamApplication
ALTER TABLE "TeamApplication" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamApplication" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: TeamInvitation
ALTER TABLE "TeamInvitation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamInvitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: TeamMember
ALTER TABLE "TeamMember" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable: TeamMembership
ALTER TABLE "TeamMembership" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "PointHistory_action_createdAt_idx" ON "PointHistory"("action", "createdAt");
