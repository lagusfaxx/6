-- AlterTable
ALTER TABLE "Establishment" ADD COLUMN "websiteUrl" TEXT,
ADD COLUMN "externalOnly" BOOLEAN NOT NULL DEFAULT false;
