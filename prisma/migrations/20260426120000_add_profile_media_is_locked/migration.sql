-- AlterTable: lock photos uploaded during professional registration so they cannot be deleted later
ALTER TABLE "ProfileMedia" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
