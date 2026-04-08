-- Backfill avatarUrl for professionals who have gallery photos but no avatar.
-- Fixes profiles registered via /publicate that never set avatarUrl.
-- This migration runs once automatically on deploy.

UPDATE "User" u
SET "avatarUrl" = sub.url
FROM (
  SELECT DISTINCT ON ("ownerId") "ownerId", "url"
  FROM "ProfileMedia"
  WHERE "type" = 'IMAGE'
  ORDER BY "ownerId", "createdAt" ASC
) sub
WHERE u.id = sub."ownerId"
  AND u."profileType" = 'PROFESSIONAL'
  AND u."avatarUrl" IS NULL;
