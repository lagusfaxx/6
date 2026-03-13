-- CreateEnum
CREATE TYPE "BannerAdTier" AS ENUM ('STANDARD', 'GOLD');

-- AlterTable
ALTER TABLE "Banner"
ADD COLUMN "adTier" "BannerAdTier" NOT NULL DEFAULT 'STANDARD';
