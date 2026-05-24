-- Add flag for admin-curated stories to appear in home cover rotation
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "showInHome" BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to quickly fetch active, admin-approved stories
CREATE INDEX IF NOT EXISTS "Story_showInHome_expiresAt_idx" ON "Story"("showInHome", "expiresAt");
