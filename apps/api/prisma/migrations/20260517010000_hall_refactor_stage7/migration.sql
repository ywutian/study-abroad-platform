-- Hall refactor Stage 7: hallPublicProfile (desensitized snapshot for hall
-- surfaces — keeps the profile original out of hall services) + the
-- PointsRedemption cross-module redemption ledger.
--
-- All additions are nullable / defaulted (zero-downtime).

-- ============================================
-- 1. User.hallPublicProfile (nullable JSONB)
-- ============================================

ALTER TABLE "User"
  ADD COLUMN "hallPublicProfile" JSONB;

-- ============================================
-- 2. Points redemption (cross-module redemption history)
-- ============================================

CREATE TYPE "RedemptionType" AS ENUM (
  'CONSULT_15MIN',
  'MEMBERSHIP_MONTHLY',
  'CASE_PREMIUM_UNLOCK',
  'EXPERT_LIST_UNLOCK',
  'PREDICTION_DEEP_DIVE'
);

CREATE TYPE "RedemptionStatus" AS ENUM (
  'PENDING',
  'FULFILLED',
  'CANCELLED'
);

CREATE TABLE "PointsRedemption" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "type"         "RedemptionType" NOT NULL,
  "pointsSpent"  INTEGER NOT NULL,
  "status"       "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "metadata"     JSONB,
  "fulfilledAt"  TIMESTAMP(3),
  "cancelledAt"  TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PointsRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PointsRedemption_userId_createdAt_idx"
  ON "PointsRedemption"("userId", "createdAt");

CREATE INDEX "PointsRedemption_type_idx" ON "PointsRedemption"("type");

CREATE INDEX "PointsRedemption_status_idx" ON "PointsRedemption"("status");

ALTER TABLE "PointsRedemption"
  ADD CONSTRAINT "PointsRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
