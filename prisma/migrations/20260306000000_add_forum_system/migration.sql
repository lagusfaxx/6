-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FORUM_REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'FORUM_NEW_THREAD';

-- CreateTable
CREATE TABLE "ForumCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoryId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "threadId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForumCategory_slug_key" ON "ForumCategory"("slug");

-- CreateIndex
CREATE INDEX "ForumThread_categoryId_lastPostAt_idx" ON "ForumThread"("categoryId", "lastPostAt");

-- CreateIndex
CREATE INDEX "ForumThread_authorId_idx" ON "ForumThread"("authorId");

-- CreateIndex
CREATE INDEX "ForumPost_threadId_createdAt_idx" ON "ForumPost"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default forum categories
INSERT INTO "ForumCategory" ("id", "name", "slug", "description", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Escorts Santiago', 'escorts-santiago', 'Discusiones sobre escorts en Santiago', 0, NOW(), NOW()),
  (gen_random_uuid(), 'Masajes', 'masajes', 'Experiencias y recomendaciones de masajistas', 1, NOW(), NOW()),
  (gen_random_uuid(), 'Experiencias', 'experiencias', 'Comparte tus experiencias con la comunidad', 2, NOW(), NOW()),
  (gen_random_uuid(), 'Moteles', 'moteles', 'Información y opiniones sobre moteles', 3, NOW(), NOW()),
  (gen_random_uuid(), 'Consejos', 'consejos', 'Consejos y recomendaciones útiles', 4, NOW(), NOW()),
  (gen_random_uuid(), 'General', 'general', 'Conversaciones generales de la comunidad', 5, NOW(), NOW());
