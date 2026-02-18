-- Merit counters and review tags for professional profiles
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "completedServices" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "profileViews" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reviewTagsSummary" JSONB;
