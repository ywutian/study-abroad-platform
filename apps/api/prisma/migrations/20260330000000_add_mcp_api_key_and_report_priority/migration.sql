-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "mcp_api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" VARCHAR(12) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_api_keys_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Report — add priority and assignedTo
ALTER TABLE "Report" ADD COLUMN "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Report" ADD COLUMN "assignedTo" TEXT;

-- AlterTable: DataImportStaging — add assignedTo
ALTER TABLE "DataImportStaging" ADD COLUMN "assignedTo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "mcp_api_keys_keyHash_key" ON "mcp_api_keys"("keyHash");
CREATE INDEX "mcp_api_keys_userId_idx" ON "mcp_api_keys"("userId");
CREATE INDEX "mcp_api_keys_keyPrefix_idx" ON "mcp_api_keys"("keyPrefix");

CREATE INDEX "Report_priority_status_idx" ON "Report"("priority", "status");
CREATE INDEX "Report_assignedTo_idx" ON "Report"("assignedTo");

-- AddForeignKey
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ADD CONSTRAINT "Report_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
