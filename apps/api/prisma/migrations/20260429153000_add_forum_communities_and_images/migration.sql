-- Add Reddit-style forum communities and post images.

CREATE TABLE "ForumCommunity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumCommunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForumCommunityFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumCommunityFollow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForumPostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPostImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ForumPost" ADD COLUMN "communityId" TEXT;

CREATE UNIQUE INDEX "ForumCommunity_slug_key" ON "ForumCommunity"("slug");
CREATE INDEX "ForumCommunity_createdById_idx" ON "ForumCommunity"("createdById");
CREATE INDEX "ForumCommunity_isActive_idx" ON "ForumCommunity"("isActive");
CREATE INDEX "ForumCommunity_isOfficial_idx" ON "ForumCommunity"("isOfficial");
CREATE INDEX "ForumCommunity_postCount_idx" ON "ForumCommunity"("postCount");
CREATE INDEX "ForumCommunity_followerCount_idx" ON "ForumCommunity"("followerCount");

CREATE UNIQUE INDEX "ForumCommunityFollow_userId_communityId_key" ON "ForumCommunityFollow"("userId", "communityId");
CREATE INDEX "ForumCommunityFollow_userId_idx" ON "ForumCommunityFollow"("userId");
CREATE INDEX "ForumCommunityFollow_communityId_idx" ON "ForumCommunityFollow"("communityId");

CREATE INDEX "ForumPostImage_postId_idx" ON "ForumPostImage"("postId");
CREATE INDEX "ForumPostImage_key_idx" ON "ForumPostImage"("key");

CREATE INDEX "ForumPost_communityId_idx" ON "ForumPost"("communityId");
CREATE INDEX "ForumPost_communityId_createdAt_idx" ON "ForumPost"("communityId", "createdAt");

ALTER TABLE "ForumCommunity"
  ADD CONSTRAINT "ForumCommunity_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ForumCommunityFollow"
  ADD CONSTRAINT "ForumCommunityFollow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumCommunityFollow"
  ADD CONSTRAINT "ForumCommunityFollow_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "ForumCommunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumPost"
  ADD CONSTRAINT "ForumPost_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "ForumCommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ForumPostImage"
  ADD CONSTRAINT "ForumPostImage_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
