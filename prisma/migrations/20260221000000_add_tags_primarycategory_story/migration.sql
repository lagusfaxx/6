-- AlterTable: Add tag fields and primaryCategory to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryCategory" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "serviceTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable: Story (separate from ProfileMedia, has expiry)
CREATE TABLE IF NOT EXISTS "Story" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Story_userId_idx" ON "Story"("userId");
CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story"("expiresAt");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
