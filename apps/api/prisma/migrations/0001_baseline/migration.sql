-- Baseline migration: full schema from prisma migrate diff --from-empty
-- All statements are idempotent (IF NOT EXISTS / exception handlers).

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('USER', 'VERIFIED', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'PUBLIC', 'ANONYMOUS', 'VERIFIED_ONLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "BudgetTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNLIMITED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TestType" AS ENUM ('SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ActivityCategory" AS ENUM ('ACADEMIC', 'ARTS', 'ATHLETICS', 'COMMUNITY_SERVICE', 'LEADERSHIP', 'WORK', 'RESEARCH', 'INTERNSHIP', 'CLUB', 'HOBBY', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ActivityTiming" AS ENUM ('SCHOOL_YEAR', 'SCHOOL_BREAK', 'ALL_YEAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EducationSystem" AS ENUM ('IB', 'AP', 'A_LEVEL', 'GAOKAO', 'CANADIAN', 'AUSTRALIAN', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AwardLevel" AS ENUM ('SCHOOL', 'REGIONAL', 'STATE', 'NATIONAL', 'INTERNATIONAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "CompetitionCategory" AS ENUM ('MATH', 'BIOLOGY', 'PHYSICS', 'CHEMISTRY', 'COMPUTER_SCIENCE', 'ENGINEERING_RESEARCH', 'ECONOMICS_BUSINESS', 'DEBATE_SPEECH', 'WRITING_ESSAY', 'GENERAL_ACADEMIC', 'ARTS_MUSIC', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "HighSchoolType" AS ENUM ('PUBLIC_US', 'PRIVATE_US', 'BOARDING_US', 'INTL_CN', 'PUBLIC_CN', 'PRIVATE_CN', 'INTL_OTHER', 'PUBLIC_OTHER', 'PRIVATE_OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'MESSAGE', 'CASE', 'REVIEW', 'POST', 'COMMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AdmissionResult" AS ENUM ('ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TaskType" AS ENUM ('ESSAY', 'DOCUMENT', 'TEST', 'INTERVIEW', 'RECOMMENDATION', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ApplicationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "GlobalEventCategory" AS ENUM ('TEST', 'COMPETITION', 'SUMMER_PROGRAM', 'FINANCIAL_AID', 'APPLICATION', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PersonalEventCategory" AS ENUM ('COMPETITION', 'TEST', 'SUMMER_PROGRAM', 'INTERNSHIP', 'ACTIVITY', 'MATERIAL', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PersonalEventStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "VaultItemType" AS ENUM ('PASSWORD', 'CREDENTIAL', 'DOCUMENT', 'NOTE', 'API_KEY', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ResumeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ResumeType" AS ENUM ('COLLEGE_APPLICATION', 'INTERNSHIP', 'GRADUATE_CV'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ResumeSectionType" AS ENUM ('HEADER', 'EDUCATION', 'TEST_SCORES', 'RESEARCH', 'WORK_EXPERIENCE', 'PROJECTS', 'ACTIVITIES', 'COMMUNITY_SERVICE', 'AWARDS', 'SKILLS', 'PUBLICATIONS', 'TEACHING', 'CERTIFICATIONS', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TeamVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TeamJoinPolicy" AS ENUM ('OPEN', 'INVITE_ONLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TeamMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "SchoolTier" AS ENUM ('SAFETY', 'TARGET', 'REACH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "MemoryType" AS ENUM ('FACT', 'PREFERENCE', 'DECISION', 'SUMMARY', 'FEEDBACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EntityType" AS ENUM ('SCHOOL', 'PERSON', 'EVENT', 'TOPIC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TeamStatus" AS ENUM ('RECRUITING', 'FULL', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "TeamAppStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ForumPostTag" AS ENUM ('COMPETITION', 'ACTIVITY', 'QUESTION', 'SHARING', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EssayType" AS ENUM ('COMMON_APP', 'UC', 'MAIN', 'SUPPLEMENTAL', 'WHY_SCHOOL', 'SHORT_ANSWER', 'ACTIVITY', 'OPTIONAL', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "PeerReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "EssayStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "AssessmentType" AS ENUM ('MBTI', 'HOLLAND', 'STRENGTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ModelStatus" AS ENUM ('CANDIDATE', 'SHADOW', 'CHAMPION', 'RETIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyTokenExp" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "locale" TEXT NOT NULL DEFAULT 'zh',
    "points" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "referredById" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "bannedUntil" TIMESTAMP(3),
    "banReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "realName" TEXT,
    "birthday" TIMESTAMP(3),
    "graduationDate" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "gpa" DECIMAL(3,2),
    "gpaScale" DECIMAL(3,2) NOT NULL DEFAULT 4.0,
    "currentSchool" TEXT,
    "currentSchoolType" TEXT,
    "grade" TEXT,
    "targetMajor" TEXT,
    "intendedMajor" TEXT,
    "secondMajor" TEXT,
    "regionPref" TEXT[],
    "budgetTier" "BudgetTier",
    "applicationRound" TEXT,
    "nationality" TEXT,
    "countryOfResidence" TEXT,
    "citizenship" TEXT,
    "legacy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstGeneration" BOOLEAN NOT NULL DEFAULT false,
    "needsFinancialAid" BOOLEAN,
    "educationSystem" "EducationSystem",
    "recommendationPreferences" JSONB,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TestScore" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "TestType" NOT NULL,
    "score" INTEGER NOT NULL,
    "subScores" JSONB,
    "testDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "hoursPerWeek" INTEGER,
    "weeksPerYear" INTEGER,
    "isOngoing" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "gradeLevels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timing" "ActivityTiming",
    "activityTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "ActivityCategory" NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 4,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Award" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "AwardLevel" NOT NULL,
    "year" INTEGER,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "competitionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "nameZh" TEXT,
    "category" "CompetitionCategory" NOT NULL,
    "level" "AwardLevel" NOT NULL,
    "tier" INTEGER NOT NULL,
    "description" TEXT,
    "descriptionZh" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Education" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolType" TEXT,
    "degree" TEXT,
    "major" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "gpa" DECIMAL(3,2),
    "gpaScale" DECIMAL(3,2),
    "description" TEXT,
    "highSchoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HighSchool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "abbreviation" TEXT,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "type" "HighSchoolType" NOT NULL,
    "tier" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HighSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Essay" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Essay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNorm" TEXT NOT NULL,
    "nameZh" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "state" TEXT,
    "city" TEXT,
    "scorecardId" TEXT,
    "ipedsId" TEXT,
    "usNewsRank" INTEGER,
    "qsRank" INTEGER,
    "acceptanceRate" DECIMAL(5,2),
    "tuition" INTEGER,
    "avgSalary" INTEGER,
    "totalEnrollment" INTEGER,
    "satAvg" INTEGER,
    "sat25" INTEGER,
    "sat75" INTEGER,
    "satMath25" INTEGER,
    "satMath75" INTEGER,
    "satReading25" INTEGER,
    "satReading75" INTEGER,
    "actAvg" INTEGER,
    "act25" INTEGER,
    "act75" INTEGER,
    "studentCount" INTEGER,
    "graduationRate" DECIMAL(5,2),
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "needBlindInternational" BOOLEAN NOT NULL DEFAULT false,
    "intlStudentPct" DECIMAL(5,2),
    "intlAcceptanceRate" DECIMAL(5,2),
    "nicheSafetyGrade" TEXT,
    "nicheLifeGrade" TEXT,
    "nicheFoodGrade" TEXT,
    "nicheOverallGrade" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "descriptionZh" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolMetric" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolProgram" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cipCode" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "programNameZh" TEXT,
    "competitiveness" INTEGER NOT NULL DEFAULT 3,
    "acceptanceRateEstimate" DECIMAL(5,2),
    "medianEarnings" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolCalibration" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "multiplier" DECIMAL(4,3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schoolId" TEXT,
    "tags" JSONB,
    "visibility" "TeamVisibility" NOT NULL,
    "joinPolicy" "TeamJoinPolicy" NOT NULL,
    "maxMembers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT,
    "token" TEXT,
    "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProfileTargetSchool" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "round" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileTargetSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolListItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tier" "SchoolTier" NOT NULL DEFAULT 'TARGET',
    "notes" TEXT,
    "round" TEXT,
    "isAIRecommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomRanking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionResult" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "probabilityLow" DECIMAL(5,4),
    "probabilityHigh" DECIMAL(5,4),
    "factors" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'v2',
    "tier" TEXT,
    "confidence" TEXT,
    "engineScores" JSONB,
    "suggestions" JSONB,
    "comparison" JSONB,
    "source" TEXT,
    "actualResult" TEXT,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdmissionCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" TEXT,
    "result" "AdmissionResult" NOT NULL,
    "major" TEXT,
    "gpaRange" TEXT,
    "gpa9" DOUBLE PRECISION,
    "gpa10" DOUBLE PRECISION,
    "gpa11" DOUBLE PRECISION,
    "gpa12" DOUBLE PRECISION,
    "ucCappedGpa" DOUBLE PRECISION,
    "ucUncappedGpa" DOUBLE PRECISION,
    "gpaScale" DOUBLE PRECISION,
    "satRange" TEXT,
    "actRange" TEXT,
    "toeflRange" TEXT,
    "tags" TEXT[],
    "activityList" TEXT,
    "essayType" "EssayType",
    "essayPrompt" TEXT,
    "essayContent" TEXT,
    "promptNumber" INTEGER,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "proofType" TEXT NOT NULL,
    "proofData" TEXT,
    "proofUrl" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isRecalled" BOOLEAN NOT NULL DEFAULT false,
    "recalledAt" TIMESTAMP(3),
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "academicScore" INTEGER NOT NULL,
    "testScore" INTEGER NOT NULL DEFAULT 5,
    "activityScore" INTEGER NOT NULL,
    "awardScore" INTEGER NOT NULL DEFAULT 5,
    "overallScore" INTEGER NOT NULL,
    "comment" TEXT,
    "academicComment" TEXT,
    "testComment" TEXT,
    "activityComment" TEXT,
    "awardComment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "tags" TEXT[],
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReviewReaction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "items" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserListVote" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserListVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "context" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "agentType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "agentType" TEXT,
    "toolCalls" JSONB,
    "tokensUsed" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "embedding" vector(1536),
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Entity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attributes" JSONB,
    "relations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserAIPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communicationStyle" TEXT NOT NULL DEFAULT 'friendly',
    "responseLength" TEXT NOT NULL DEFAULT 'moderate',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "schoolPreferences" JSONB,
    "essayPreferences" JSONB,
    "enableMemory" BOOLEAN NOT NULL DEFAULT true,
    "enableSuggestions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAIPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentTokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "agentType" TEXT,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,6) NOT NULL,
    "toolName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'FREE',
    "dailyTokens" INTEGER NOT NULL DEFAULT 100000,
    "monthlyTokens" INTEGER NOT NULL DEFAULT 2000000,
    "dailyCost" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "monthlyCost" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "customLimits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "traceId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentSecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "payload" JSONB,
    "mitigationAction" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentConfigVersion" (
    "id" TEXT NOT NULL,
    "configType" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemoryCompaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceMemoryIds" TEXT[],
    "compactedMemoryId" TEXT NOT NULL,
    "compressionType" TEXT NOT NULL,
    "originalTokens" INTEGER NOT NULL,
    "compactedTokens" INTEGER NOT NULL,
    "compressionRatio" DECIMAL(5,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryCompaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "description" TEXT,
    "descriptionZh" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumPost" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "postTag" "ForumPostTag",
    "isTeamPost" BOOLEAN NOT NULL DEFAULT false,
    "teamSize" INTEGER,
    "currentSize" INTEGER DEFAULT 1,
    "requirements" TEXT,
    "teamDeadline" TIMESTAMP(3),
    "teamStatus" "TeamStatus" NOT NULL DEFAULT 'RECRUITING',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ForumLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamApplication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "message" TEXT,
    "resumeId" TEXT,
    "status" "TeamAppStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EssayExample" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "schoolId" TEXT,
    "type" "EssayType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "year" INTEGER,
    "promptNumber" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(2,1),
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EssayExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CaseSwipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "actualResult" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseSwipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SwipeStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalSwipes" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "badge" TEXT NOT NULL DEFAULT 'bronze',
    "dailyChallengeCount" INTEGER NOT NULL DEFAULT 0,
    "dailyChallengeDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwipeStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PointHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "idempotencyKey" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PeerReview" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "profileScore" SMALLINT,
    "helpfulScore" SMALLINT,
    "responseScore" SMALLINT,
    "overallScore" SMALLINT,
    "comment" TEXT,
    "reverseProfileScore" SMALLINT,
    "reverseHelpfulScore" SMALLINT,
    "reverseResponseScore" SMALLINT,
    "reverseOverallScore" SMALLINT,
    "reverseComment" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "PeerReviewStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolDeadline" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "financialAidDeadline" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "essayPrompts" JSONB,
    "essayCount" INTEGER,
    "interviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "interviewDeadline" TIMESTAMP(3),
    "applicationFee" INTEGER,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GlobalEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleZh" TEXT,
    "category" "GlobalEventCategory" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "lateDeadline" TIMESTAMP(3),
    "resultDate" TIMESTAMP(3),
    "description" TEXT,
    "descriptionZh" TEXT,
    "url" TEXT,
    "year" INTEGER NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationTimeline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationTask" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "essayId" TEXT,
    "essayPrompt" TEXT,
    "wordLimit" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PersonalEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "globalEventId" TEXT,
    "title" TEXT NOT NULL,
    "category" "PersonalEventCategory" NOT NULL,
    "deadline" TIMESTAMP(3),
    "eventDate" TIMESTAMP(3),
    "status" "PersonalEventStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PersonalTask" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EssayPrompt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "EssayType" NOT NULL DEFAULT 'SUPPLEMENTAL',
    "status" "EssayStatus" NOT NULL DEFAULT 'PENDING',
    "year" INTEGER NOT NULL DEFAULT 2025,
    "prompt" TEXT NOT NULL,
    "promptZh" TEXT,
    "wordLimit" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "aiTips" TEXT,
    "aiCategory" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "previousYearPromptId" TEXT,
    "changeType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EssayPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EssayPromptSource" (
    "id" TEXT NOT NULL,
    "essayPromptId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rawContent" TEXT,
    "confidence" DOUBLE PRECISION,
    "scrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssayPromptSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolEssaySource" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "EssayPipelineRun" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "title" TEXT NOT NULL,
    "titleZh" TEXT,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssessmentResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "majorRecommendations" JSONB,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EssayPromptAudit" (
    "id" TEXT NOT NULL,
    "essayPromptId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "EssayStatus",
    "toStatus" "EssayStatus",
    "operatorId" TEXT NOT NULL,
    "operatorType" TEXT NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssayPromptAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VaultItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VaultItemType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SchoolRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "preferences" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "analysis" JSONB NOT NULL,
    "summary" TEXT,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EssayAIResult" (
    "id" TEXT NOT NULL,
    "essayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "changes" JSONB,
    "scores" JSONB,
    "suggestions" JSONB,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EssayAIResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CaseView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My Resume',
    "status" "ResumeStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "ResumeType" NOT NULL DEFAULT 'COLLEGE_APPLICATION',
    "templateId" TEXT NOT NULL DEFAULT 'jake-classic',
    "language" TEXT NOT NULL DEFAULT 'en',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ResumeSection" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "type" "ResumeSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ResumeSnapshot" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ResumeAIReview" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "overallScore" INTEGER,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeAIReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionModel" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "modelType" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "medians" JSONB NOT NULL,
    "selectivityBand" TEXT,
    "trainSamples" INTEGER NOT NULL,
    "valSamples" INTEGER NOT NULL,
    "trainAuc" DOUBLE PRECISION NOT NULL,
    "valAuc" DOUBLE PRECISION NOT NULL,
    "brierScore" DOUBLE PRECISION NOT NULL,
    "calibrationECE" DOUBLE PRECISION NOT NULL,
    "cvMeanAuc" DOUBLE PRECISION,
    "cvStdAuc" DOUBLE PRECISION,
    "status" "ModelStatus" NOT NULL DEFAULT 'CANDIDATE',
    "promotedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "shadowMetrics" JSONB,
    "fairnessMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_isBanned_idx" ON "User"("isBanned");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Profile_visibility_idx" ON "Profile"("visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Profile_onboardingCompleted_idx" ON "Profile"("onboardingCompleted");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestScore_profileId_idx" ON "TestScore"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Activity_profileId_idx" ON "Activity"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Activity_activityTemplateId_idx" ON "Activity"("activityTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityTemplate_name_key" ON "ActivityTemplate"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityTemplate_tier_idx" ON "ActivityTemplate"("tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityTemplate_category_idx" ON "ActivityTemplate"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Award_profileId_idx" ON "Award"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Award_competitionId_idx" ON "Award"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Competition_abbreviation_key" ON "Competition"("abbreviation");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Competition_category_idx" ON "Competition"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Competition_tier_idx" ON "Competition"("tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Education_profileId_idx" ON "Education"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Education_highSchoolId_idx" ON "Education"("highSchoolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HighSchool_abbreviation_key" ON "HighSchool"("abbreviation");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HighSchool_country_idx" ON "HighSchool"("country");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HighSchool_tier_idx" ON "HighSchool"("tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HighSchool_type_idx" ON "HighSchool"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HighSchool_name_country_state_key" ON "HighSchool"("name", "country", "state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Essay_profileId_idx" ON "Essay"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "School_nameNorm_key" ON "School"("nameNorm");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "School_scorecardId_key" ON "School"("scorecardId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "School_ipedsId_key" ON "School"("ipedsId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "School_name_idx" ON "School"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "School_nameZh_idx" ON "School"("nameZh");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "School_usNewsRank_idx" ON "School"("usNewsRank");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "School_isPrivate_idx" ON "School"("isPrivate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolMetric_schoolId_idx" ON "SchoolMetric"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolMetric_schoolId_year_metricKey_key" ON "SchoolMetric"("schoolId", "year", "metricKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolProgram_schoolId_idx" ON "SchoolProgram"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolProgram_cipCode_idx" ON "SchoolProgram"("cipCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolProgram_schoolId_cipCode_key" ON "SchoolProgram"("schoolId", "cipCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolCalibration_schoolId_key" ON "SchoolCalibration"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Team_creatorId_idx" ON "Team"("creatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Team_schoolId_idx" ON "Team"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Team_visibility_idx" ON "Team"("visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Team_createdAt_idx" ON "Team"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMembership_userId_idx" ON "TeamMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMembership_teamId_userId_key" ON "TeamMembership"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvitation_token_key" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamInvitation_teamId_idx" ON "TeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamInvitation_inviteeId_idx" ON "TeamInvitation"("inviteeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamInvitation_token_idx" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamInvitation_status_idx" ON "TeamInvitation"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProfileTargetSchool_profileId_idx" ON "ProfileTargetSchool"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileTargetSchool_profileId_schoolId_key" ON "ProfileTargetSchool"("profileId", "schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolListItem_userId_idx" ON "SchoolListItem"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolListItem_tier_idx" ON "SchoolListItem"("tier");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolListItem_userId_schoolId_key" ON "SchoolListItem"("userId", "schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomRanking_userId_idx" ON "CustomRanking"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomRanking_isPublic_idx" ON "CustomRanking"("isPublic");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionResult_profileId_idx" ON "PredictionResult"("profileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionResult_schoolId_idx" ON "PredictionResult"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionResult_modelVersion_idx" ON "PredictionResult"("modelVersion");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionResult_actualResult_idx" ON "PredictionResult"("actualResult");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PredictionResult_profileId_schoolId_key" ON "PredictionResult"("profileId", "schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_profileId_schoolId_createdAt_idx" ON "PredictionSnapshot"("profileId", "schoolId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionSnapshot_profileId_createdAt_idx" ON "PredictionSnapshot"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdmissionCase_userId_idx" ON "AdmissionCase"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdmissionCase_schoolId_idx" ON "AdmissionCase"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdmissionCase_visibility_idx" ON "AdmissionCase"("visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdmissionCase_year_idx" ON "AdmissionCase"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdmissionCase_essayType_idx" ON "AdmissionCase"("essayType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationRequest_caseId_idx" ON "VerificationRequest"("caseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VerificationRequest_status_idx" ON "VerificationRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Block_blockerId_idx" ON "Block"("blockerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_profileUserId_status_createdAt_idx" ON "Review"("profileUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Review_reviewerId_profileUserId_key" ON "Review"("reviewerId", "profileUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReviewReaction_reviewId_idx" ON "ReviewReaction"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReaction_reviewId_userId_type_key" ON "ReviewReaction"("reviewId", "userId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserList_userId_idx" ON "UserList"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserList_isPublic_idx" ON "UserList"("isPublic");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserListVote_listId_idx" ON "UserListVote"("listId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserListVote_listId_userId_key" ON "UserListVote"("listId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentConversation_userId_idx" ON "AgentConversation"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentConversation_createdAt_idx" ON "AgentConversation"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentConversation_userId_updatedAt_idx" ON "AgentConversation"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentMessage_conversationId_idx" ON "AgentMessage"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentMessage_createdAt_idx" ON "AgentMessage"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentMessage_conversationId_createdAt_idx" ON "AgentMessage"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_userId_idx" ON "Memory"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_type_idx" ON "Memory"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_category_idx" ON "Memory"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_importance_idx" ON "Memory"("importance");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_userId_type_idx" ON "Memory"("userId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_userId_importance_idx" ON "Memory"("userId", "importance" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_userId_type_importance_idx" ON "Memory"("userId", "type", "importance" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_userId_category_idx" ON "Memory"("userId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_accessCount_lastAccessedAt_idx" ON "Memory"("accessCount", "lastAccessedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Memory_updatedAt_idx" ON "Memory"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Entity_userId_idx" ON "Entity"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Entity_type_idx" ON "Entity"("type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Entity_userId_type_name_key" ON "Entity"("userId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserAIPreference_userId_key" ON "UserAIPreference"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTokenUsage_userId_idx" ON "AgentTokenUsage"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTokenUsage_userId_createdAt_idx" ON "AgentTokenUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTokenUsage_agentType_idx" ON "AgentTokenUsage"("agentType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTokenUsage_createdAt_idx" ON "AgentTokenUsage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgentQuota_userId_key" ON "AgentQuota"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentQuota_tier_idx" ON "AgentQuota"("tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_userId_idx" ON "AgentAuditLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_traceId_idx" ON "AgentAuditLog"("traceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_action_idx" ON "AgentAuditLog"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_createdAt_idx" ON "AgentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_status_idx" ON "AgentAuditLog"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_userId_action_createdAt_idx" ON "AgentAuditLog"("userId", "action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentAuditLog_resource_createdAt_idx" ON "AgentAuditLog"("resource", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_userId_idx" ON "AgentSecurityEvent"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_eventType_idx" ON "AgentSecurityEvent"("eventType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_severity_idx" ON "AgentSecurityEvent"("severity");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_resolved_idx" ON "AgentSecurityEvent"("resolved");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_createdAt_idx" ON "AgentSecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentSecurityEvent_userId_eventType_createdAt_idx" ON "AgentSecurityEvent"("userId", "eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentConfigVersion_isActive_idx" ON "AgentConfigVersion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfigVersion_configType_configKey_version_key" ON "AgentConfigVersion"("configType", "configKey", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemoryCompaction_userId_idx" ON "MemoryCompaction"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemoryCompaction_createdAt_idx" ON "MemoryCompaction"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTask_status_idx" ON "AgentTask"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTask_type_idx" ON "AgentTask"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTask_scheduledAt_idx" ON "AgentTask"("scheduledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTask_priority_status_idx" ON "AgentTask"("priority", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ForumCategory_name_key" ON "ForumCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ForumCategory_nameZh_key" ON "ForumCategory"("nameZh");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumCategory_isActive_idx" ON "ForumCategory"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumCategory_sortOrder_idx" ON "ForumCategory"("sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumPost_categoryId_idx" ON "ForumPost"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumPost_isTeamPost_idx" ON "ForumPost"("isTeamPost");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumPost_postTag_idx" ON "ForumPost"("postTag");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumPost_likeCount_idx" ON "ForumPost"("likeCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumComment_postId_idx" ON "ForumComment"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumComment_authorId_idx" ON "ForumComment"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumComment_parentId_idx" ON "ForumComment"("parentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumLike_postId_idx" ON "ForumLike"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForumLike_userId_idx" ON "ForumLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ForumLike_postId_userId_key" ON "ForumLike"("postId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMember_postId_idx" ON "TeamMember"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_postId_userId_key" ON "TeamMember"("postId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamApplication_postId_idx" ON "TeamApplication"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamApplication_applicantId_idx" ON "TeamApplication"("applicantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamApplication_status_idx" ON "TeamApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeamApplication_postId_applicantId_key" ON "TeamApplication"("postId", "applicantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayExample_schoolId_idx" ON "EssayExample"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayExample_type_idx" ON "EssayExample"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayExample_isPublic_idx" ON "EssayExample"("isPublic");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayExample_year_idx" ON "EssayExample"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaseSwipe_userId_idx" ON "CaseSwipe"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaseSwipe_caseId_idx" ON "CaseSwipe"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CaseSwipe_userId_caseId_key" ON "CaseSwipe"("userId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SwipeStats_userId_key" ON "SwipeStats"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SwipeStats_badge_idx" ON "SwipeStats"("badge");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SwipeStats_correctCount_idx" ON "SwipeStats"("correctCount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PointHistory_userId_idx" ON "PointHistory"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PointHistory_createdAt_idx" ON "PointHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PeerReview_reviewerId_idx" ON "PeerReview"("reviewerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PeerReview_revieweeId_idx" ON "PeerReview"("revieweeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PeerReview_status_idx" ON "PeerReview"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PeerReview_expiresAt_idx" ON "PeerReview"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PeerReview_reviewerId_revieweeId_key" ON "PeerReview"("reviewerId", "revieweeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolDeadline_schoolId_idx" ON "SchoolDeadline"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolDeadline_year_idx" ON "SchoolDeadline"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolDeadline_applicationDeadline_idx" ON "SchoolDeadline"("applicationDeadline");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolDeadline_schoolId_year_round_key" ON "SchoolDeadline"("schoolId", "year", "round");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GlobalEvent_category_idx" ON "GlobalEvent"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GlobalEvent_eventDate_idx" ON "GlobalEvent"("eventDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GlobalEvent_year_isActive_idx" ON "GlobalEvent"("year", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationTimeline_userId_idx" ON "ApplicationTimeline"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationTimeline_deadline_idx" ON "ApplicationTimeline"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationTimeline_userId_schoolId_round_key" ON "ApplicationTimeline"("userId", "schoolId", "round");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationTask_timelineId_idx" ON "ApplicationTask"("timelineId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationTask_dueDate_idx" ON "ApplicationTask"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonalEvent_userId_idx" ON "PersonalEvent"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonalEvent_deadline_idx" ON "PersonalEvent"("deadline");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonalEvent_category_idx" ON "PersonalEvent"("category");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PersonalEvent_userId_globalEventId_key" ON "PersonalEvent"("userId", "globalEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonalTask_eventId_idx" ON "PersonalTask"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PersonalTask_dueDate_idx" ON "PersonalTask"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPrompt_schoolId_idx" ON "EssayPrompt"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPrompt_status_idx" ON "EssayPrompt"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPrompt_type_idx" ON "EssayPrompt"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPrompt_year_idx" ON "EssayPrompt"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPrompt_changeType_idx" ON "EssayPrompt"("changeType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPromptSource_essayPromptId_idx" ON "EssayPromptSource"("essayPromptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolEssaySource_schoolId_idx" ON "SchoolEssaySource"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolEssaySource_isActive_idx" ON "SchoolEssaySource"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolEssaySource_scrapeGroup_idx" ON "SchoolEssaySource"("scrapeGroup");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolEssaySource_schoolId_sourceType_key" ON "SchoolEssaySource"("schoolId", "sourceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPipelineRun_status_idx" ON "EssayPipelineRun"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPipelineRun_year_idx" ON "EssayPipelineRun"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPipelineRun_startedAt_idx" ON "EssayPipelineRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_type_key" ON "Assessment"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentResult_userId_idx" ON "AssessmentResult"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssessmentResult_assessmentId_idx" ON "AssessmentResult"("assessmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPromptAudit_essayPromptId_idx" ON "EssayPromptAudit"("essayPromptId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayPromptAudit_operatorId_idx" ON "EssayPromptAudit"("operatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VaultItem_userId_idx" ON "VaultItem"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VaultItem_type_idx" ON "VaultItem"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VaultItem_category_idx" ON "VaultItem"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolRecommendation_userId_idx" ON "SchoolRecommendation"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SchoolRecommendation_createdAt_idx" ON "SchoolRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayAIResult_essayId_idx" ON "EssayAIResult"("essayId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EssayAIResult_type_idx" ON "EssayAIResult"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaseView_userId_idx" ON "CaseView"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CaseView_caseId_idx" ON "CaseView"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CaseView_userId_caseId_key" ON "CaseView"("userId", "caseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Resume_userId_idx" ON "Resume"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Resume_userId_updatedAt_idx" ON "Resume"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ResumeSection_resumeId_idx" ON "ResumeSection"("resumeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ResumeSnapshot_resumeId_idx" ON "ResumeSnapshot"("resumeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ResumeAIReview_resumeId_idx" ON "ResumeAIReview"("resumeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PredictionModel_version_key" ON "PredictionModel"("version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionModel_status_idx" ON "PredictionModel"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionModel_tier_selectivityBand_idx" ON "PredictionModel"("tier", "selectivityBand");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TestScore" ADD CONSTRAINT "TestScore_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Activity" ADD CONSTRAINT "Activity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activityTemplateId_fkey" FOREIGN KEY ("activityTemplateId") REFERENCES "ActivityTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Award" ADD CONSTRAINT "Award_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Award" ADD CONSTRAINT "Award_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Education" ADD CONSTRAINT "Education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Education" ADD CONSTRAINT "Education_highSchoolId_fkey" FOREIGN KEY ("highSchoolId") REFERENCES "HighSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Essay" ADD CONSTRAINT "Essay_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolMetric" ADD CONSTRAINT "SchoolMetric_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolProgram" ADD CONSTRAINT "SchoolProgram_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolCalibration" ADD CONSTRAINT "SchoolCalibration_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Team" ADD CONSTRAINT "Team_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Team" ADD CONSTRAINT "Team_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ProfileTargetSchool" ADD CONSTRAINT "ProfileTargetSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolListItem" ADD CONSTRAINT "SchoolListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolListItem" ADD CONSTRAINT "SchoolListItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CustomRanking" ADD CONSTRAINT "CustomRanking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PredictionResult" ADD CONSTRAINT "PredictionResult_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AdmissionCase" ADD CONSTRAINT "AdmissionCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AdmissionCase" ADD CONSTRAINT "AdmissionCase_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AdmissionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Review" ADD CONSTRAINT "Review_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReviewReaction" ADD CONSTRAINT "ReviewReaction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ReviewReaction" ADD CONSTRAINT "ReviewReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "UserList" ADD CONSTRAINT "UserList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "UserListVote" ADD CONSTRAINT "UserListVote_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "UserListVote" ADD CONSTRAINT "UserListVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ForumComment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ForumLike" ADD CONSTRAINT "ForumLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "EssayExample" ADD CONSTRAINT "EssayExample_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CaseSwipe" ADD CONSTRAINT "CaseSwipe_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AdmissionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SwipeStats" ADD CONSTRAINT "SwipeStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolDeadline" ADD CONSTRAINT "SchoolDeadline_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ApplicationTimeline" ADD CONSTRAINT "ApplicationTimeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ApplicationTimeline" ADD CONSTRAINT "ApplicationTimeline_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ApplicationTask" ADD CONSTRAINT "ApplicationTask_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "ApplicationTimeline"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_globalEventId_fkey" FOREIGN KEY ("globalEventId") REFERENCES "GlobalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "PersonalTask" ADD CONSTRAINT "PersonalTask_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PersonalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "EssayPrompt" ADD CONSTRAINT "EssayPrompt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "EssayPromptSource" ADD CONSTRAINT "EssayPromptSource_essayPromptId_fkey" FOREIGN KEY ("essayPromptId") REFERENCES "EssayPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolEssaySource" ADD CONSTRAINT "SchoolEssaySource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "EssayPromptAudit" ADD CONSTRAINT "EssayPromptAudit_essayPromptId_fkey" FOREIGN KEY ("essayPromptId") REFERENCES "EssayPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "SchoolRecommendation" ADD CONSTRAINT "SchoolRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "EssayAIResult" ADD CONSTRAINT "EssayAIResult_essayId_fkey" FOREIGN KEY ("essayId") REFERENCES "Essay"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CaseView" ADD CONSTRAINT "CaseView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "CaseView" ADD CONSTRAINT "CaseView_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AdmissionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ResumeSection" ADD CONSTRAINT "ResumeSection_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ResumeSnapshot" ADD CONSTRAINT "ResumeSnapshot_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "ResumeAIReview" ADD CONSTRAINT "ResumeAIReview_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

