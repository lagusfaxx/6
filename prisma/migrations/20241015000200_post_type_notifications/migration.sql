DO $$ BEGIN
  CREATE TYPE "PostType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'SUBSCRIPTION_STARTED',
    'SUBSCRIPTION_RENEWED',
    'MESSAGE_RECEIVED',
    'POST_PUBLISHED',
    'SERVICE_PUBLISHED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "allowFreeMessages" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "type" "PostType" NOT NULL DEFAULT 'IMAGE';

UPDATE "Post"
SET "type" = 'VIDEO'
WHERE EXISTS (
  SELECT 1
  FROM "Media"
  WHERE "Media"."postId" = "Post"."id"
    AND "Media"."type" = 'VIDEO'
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "type" "NotificationType" NOT NULL,
  "data" jsonb,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
