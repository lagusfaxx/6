-- Creator health-exam document submission fields.
-- Status values: NULL (none) | 'pending' | 'approved' | 'rejected'

ALTER TABLE "User" ADD COLUMN "examsDocumentUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "examsStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "examsSubmittedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "examsReviewedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "examsRejectionReason" TEXT;

CREATE INDEX "User_examsStatus_idx" ON "User"("examsStatus");
