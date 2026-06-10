-- Add U-Mate notification types used by apps/api/src/umate/routes.ts.
-- Without these enum values, UMATE_NEW_POST / UMATE_NEW_COMMENT
-- notification creates fail silently.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UMATE_NEW_POST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UMATE_NEW_COMMENT';
