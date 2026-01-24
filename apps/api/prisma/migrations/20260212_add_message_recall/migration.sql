-- AlterTable
ALTER TABLE "Message" ADD COLUMN "isRecalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recalledAt" TIMESTAMP(3);
