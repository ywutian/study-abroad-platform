-- Schema declares ForumCommunity.updatedAt and ForumCommunityFollow.updatedAt as
-- `@updatedAt`, which Prisma manages at the app layer (no SQL DEFAULT). The
-- creating migration (20260429153000_add_forum_communities_and_images) shipped
-- a `DEFAULT CURRENT_TIMESTAMP`, causing migration-vs-schema drift in CI.
-- Drop those defaults to bring the database in line with the Prisma schema.

ALTER TABLE "ForumCommunity" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ForumCommunityFollow" ALTER COLUMN "updatedAt" DROP DEFAULT;
