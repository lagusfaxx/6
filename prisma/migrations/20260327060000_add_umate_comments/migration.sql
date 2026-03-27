-- AlterTable
ALTER TABLE "UmatePost" ADD COLUMN "commentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UmateComment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UmateComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UmateComment_postId_createdAt_idx" ON "UmateComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "UmateComment_userId_idx" ON "UmateComment"("userId");

-- AddForeignKey
ALTER TABLE "UmateComment" ADD CONSTRAINT "UmateComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "UmatePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmateComment" ADD CONSTRAINT "UmateComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
