-- Seed-forum-posts used to plant Math.random like/view counts on demo
-- authors. Real likes live in ForumLike; denormalised likeCount for demo
-- posts is rebuilt from that table. viewCount has no source of truth, so
-- demo views go to 0 rather than keep fabricated heat.

UPDATE "ForumPost" AS p
SET
  "likeCount" = (
    SELECT COUNT(*)::int FROM "ForumLike" AS l WHERE l."postId" = p.id
  ),
  "viewCount" = 0
WHERE p."authorId" IN (
  SELECT id FROM "User" WHERE email LIKE '%@demo.studyabroad.com'
);
