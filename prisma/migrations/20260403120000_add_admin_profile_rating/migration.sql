-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminQualityScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AdminProfileRating" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "ratingPhotoQuality" INTEGER NOT NULL,
    "ratingCompleteness" INTEGER NOT NULL,
    "ratingPresentation" INTEGER NOT NULL,
    "ratingAuthenticity" INTEGER NOT NULL,
    "ratingValue" INTEGER NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfileRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminProfileRating_profileId_idx" ON "AdminProfileRating"("profileId");

-- CreateIndex
CREATE INDEX "AdminProfileRating_overallScore_idx" ON "AdminProfileRating"("overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfileRating_profileId_adminId_key" ON "AdminProfileRating"("profileId", "adminId");

-- AddForeignKey
ALTER TABLE "AdminProfileRating" ADD CONSTRAINT "AdminProfileRating_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfileRating" ADD CONSTRAINT "AdminProfileRating_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
