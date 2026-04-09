-- Extend active stories from 24h to 7 days (from createdAt)
UPDATE "Story"
SET "expiresAt" = "createdAt" + INTERVAL '7 days'
WHERE "expiresAt" > NOW();
