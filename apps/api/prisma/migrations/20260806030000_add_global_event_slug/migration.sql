-- AlterTable
ALTER TABLE "GlobalEvent" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GlobalEvent_slug_key" ON "GlobalEvent"("slug");

