-- CreateTable
CREATE TABLE "PendingGoldRegistration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "formData" TEXT NOT NULL,
    "fileUrls" TEXT NOT NULL DEFAULT '[]',
    "flowToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingGoldRegistration_pkey" PRIMARY KEY ("id")
);
