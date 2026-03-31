-- Composite indexes for common ForumPost query patterns.
-- categoryId + createdAt: category feeds sorted by date
-- authorId + createdAt: user profile post lists sorted by date

-- CreateIndex
CREATE INDEX "ForumPost_categoryId_createdAt_idx" ON "ForumPost"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_authorId_createdAt_idx" ON "ForumPost"("authorId", "createdAt");
