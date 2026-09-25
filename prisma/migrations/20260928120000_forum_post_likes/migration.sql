-- "Me gusta" reales en el foro (antes el corazón era sólo estado local).
CREATE TABLE IF NOT EXISTS "ForumPostLike" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumPostLike_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE INDEX IF NOT EXISTS "ForumPostLike_userId_idx" ON "ForumPostLike"("userId");

DO $$ BEGIN
  ALTER TABLE "ForumPostLike" ADD CONSTRAINT "ForumPostLike_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ForumPostLike" ADD CONSTRAINT "ForumPostLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
