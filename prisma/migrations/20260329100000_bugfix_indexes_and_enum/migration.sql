-- Add missing UMATE_NEW_SUBSCRIBER to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UMATE_NEW_SUBSCRIBER';
