-- AlterTable: make passwordHash nullable for quick-register flow
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AddColumn: token for "create your password" email flow
ALTER TABLE "User" ADD COLUMN "passwordSetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordSetTokenExpiresAt" TIMESTAMP(3);
