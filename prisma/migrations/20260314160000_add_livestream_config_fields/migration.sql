-- AlterTable
ALTER TABLE "LiveStream" ADD COLUMN "privateShowPrice" INTEGER;
ALTER TABLE "LiveStream" ADD COLUMN "totalTipsEarned" INTEGER NOT NULL DEFAULT 0;
