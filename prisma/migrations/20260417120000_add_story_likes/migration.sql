-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STORY_LIKE';

-- AlterTable
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoryLike" (
    "id" UUID NOT NULL,
    "storyId" UUID NOT NULL,
    "userId" UUID,
    "anonymousId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoryLike_storyId_userId_key" ON "StoryLike"("storyId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoryLike_storyId_anonymousId_key" ON "StoryLike"("storyId", "anonymousId");
CREATE INDEX IF NOT EXISTS "StoryLike_storyId_idx" ON "StoryLike"("storyId");
CREATE INDEX IF NOT EXISTS "StoryLike_userId_idx" ON "StoryLike"("userId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoryLike_storyId_fkey'
    ) THEN
        ALTER TABLE "StoryLike" ADD CONSTRAINT "StoryLike_storyId_fkey"
            FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoryLike_userId_fkey'
    ) THEN
        ALTER TABLE "StoryLike" ADD CONSTRAINT "StoryLike_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;
