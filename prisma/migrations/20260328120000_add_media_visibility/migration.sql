-- Add per-media visibility to UmatePostMedia
ALTER TABLE "UmatePostMedia" ADD COLUMN "visibility" "UmatePostVisibility" NOT NULL DEFAULT 'FREE';

-- Backfill: copy post visibility to all its media
UPDATE "UmatePostMedia" m
SET "visibility" = p."visibility"
FROM "UmatePost" p
WHERE m."postId" = p."id";
