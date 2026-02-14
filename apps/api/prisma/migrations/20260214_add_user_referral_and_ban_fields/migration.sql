-- AlterTable
ALTER TABLE "User"
ADD COLUMN "referralCode" TEXT,
ADD COLUMN "referredById" TEXT,
ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bannedAt" TIMESTAMP(3),
ADD COLUMN "bannedUntil" TIMESTAMP(3),
ADD COLUMN "banReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_referredById_fkey"
FOREIGN KEY ("referredById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
