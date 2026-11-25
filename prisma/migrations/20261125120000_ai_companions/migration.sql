-- Acompañantes IA: catálogo de personajes ficticios, chat, memoria e imágenes.
-- CreateEnum
CREATE TYPE "AiCompanionGender" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "AiCompanionAccess" AS ENUM ('FREE', 'PREMIUM', 'VIP', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "AiCompanionPlanTier" AS ENUM ('FREE', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiImageStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AiMemoryKind" AS ENUM ('FACT', 'PREFERENCE', 'SUMMARY');

-- AlterEnum
ALTER TYPE "TokenTxType" ADD VALUE 'AI_COMPANION';

-- CreateTable
CREATE TABLE "AiCompanion" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "AiCompanionGender" NOT NULL,
    "age" INTEGER NOT NULL,
    "tagline" TEXT,
    "bio" TEXT,
    "appearance" TEXT NOT NULL,
    "personality" TEXT NOT NULL DEFAULT 'romantica',
    "personalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "communicationStyle" TEXT,
    "roleplayNotes" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avatarUrl" TEXT,
    "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "access" "AiCompanionAccess" NOT NULL DEFAULT 'FREE',
    "unlockTokens" INTEGER NOT NULL DEFAULT 0,
    "unlockDays" INTEGER NOT NULL DEFAULT 30,
    "imageSeed" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tier" "AiCompanionPlanTier" NOT NULL DEFAULT 'FREE',
    "tierExpiresAt" TIMESTAMP(3),
    "adultConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCompanionAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionChat" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companionId" UUID NOT NULL,
    "personality" TEXT,
    "userNickname" TEXT,
    "intensity" TEXT NOT NULL DEFAULT 'suave',
    "summary" TEXT,
    "summarizedUntil" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCompanionChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionMessage" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "imageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCompanionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionMemory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companionId" UUID NOT NULL,
    "kind" "AiMemoryKind" NOT NULL DEFAULT 'FACT',
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCompanionMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionImage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companionId" UUID NOT NULL,
    "request" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "intensity" TEXT NOT NULL DEFAULT 'suave',
    "status" "AiImageStatus" NOT NULL DEFAULT 'PENDING',
    "fileRef" TEXT,
    "tokensCharged" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCompanionImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionUnlock" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companionId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCompanionUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompanionFlag" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "companionId" UUID,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCompanionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiCompanion_slug_key" ON "AiCompanion"("slug");

-- CreateIndex
CREATE INDEX "AiCompanion_isActive_gender_sortOrder_idx" ON "AiCompanion"("isActive", "gender", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "AiCompanionAccount_userId_key" ON "AiCompanionAccount"("userId");

-- CreateIndex
CREATE INDEX "AiCompanionChat_userId_lastMessageAt_idx" ON "AiCompanionChat"("userId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiCompanionChat_userId_companionId_key" ON "AiCompanionChat"("userId", "companionId");

-- CreateIndex
CREATE INDEX "AiCompanionMessage_chatId_createdAt_idx" ON "AiCompanionMessage"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCompanionMemory_userId_companionId_idx" ON "AiCompanionMemory"("userId", "companionId");

-- CreateIndex
CREATE INDEX "AiCompanionImage_userId_companionId_createdAt_idx" ON "AiCompanionImage"("userId", "companionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiCompanionUnlock_userId_companionId_key" ON "AiCompanionUnlock"("userId", "companionId");

-- CreateIndex
CREATE INDEX "AiCompanionFlag_createdAt_idx" ON "AiCompanionFlag"("createdAt");

-- CreateIndex
CREATE INDEX "AiCompanionFlag_userId_idx" ON "AiCompanionFlag"("userId");

-- AddForeignKey
ALTER TABLE "AiCompanionAccount" ADD CONSTRAINT "AiCompanionAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionChat" ADD CONSTRAINT "AiCompanionChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionChat" ADD CONSTRAINT "AiCompanionChat_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "AiCompanion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionMessage" ADD CONSTRAINT "AiCompanionMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "AiCompanionChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionMemory" ADD CONSTRAINT "AiCompanionMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionMemory" ADD CONSTRAINT "AiCompanionMemory_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "AiCompanion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionImage" ADD CONSTRAINT "AiCompanionImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionImage" ADD CONSTRAINT "AiCompanionImage_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "AiCompanion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionUnlock" ADD CONSTRAINT "AiCompanionUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompanionUnlock" ADD CONSTRAINT "AiCompanionUnlock_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "AiCompanion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Todos los personajes son adultos: lo exige la base, no sólo la API.
ALTER TABLE "AiCompanion" ADD CONSTRAINT "AiCompanion_age_adult_check" CHECK ("age" >= 18);
