-- Add missing indexes on Message for chat performance
CREATE INDEX IF NOT EXISTS "Message_fromId_idx" ON "Message" ("fromId");
CREATE INDEX IF NOT EXISTS "Message_toId_idx" ON "Message" ("toId");
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message" ("createdAt");

-- Add missing indexes on Payment for admin queries
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment" ("userId");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment" ("status", "createdAt");

-- Add missing index on Post for feed queries
CREATE INDEX IF NOT EXISTS "Post_authorId_createdAt_idx" ON "Post" ("authorId", "createdAt");

-- Add missing indexes on ServiceRequest for dashboard queries
CREATE INDEX IF NOT EXISTS "ServiceRequest_clientId_status_idx" ON "ServiceRequest" ("clientId", "status");
CREATE INDEX IF NOT EXISTS "ServiceRequest_professionalId_status_idx" ON "ServiceRequest" ("professionalId", "status");

-- Add missing index on Favorite for user favorites list
CREATE INDEX IF NOT EXISTS "Favorite_userId_idx" ON "Favorite" ("userId");

-- Add missing index on PrivateShow for host earnings queries
CREATE INDEX IF NOT EXISTS "PrivateShow_hostId_idx" ON "PrivateShow" ("hostId");
