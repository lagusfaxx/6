-- Add slug + displayName to Category
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

UPDATE "Category"
SET "displayName" = COALESCE("displayName", "name")
WHERE "displayName" IS NULL;

UPDATE "Category"
SET "slug" = COALESCE("slug", lower(regexp_replace("name", '\\s+', '-', 'g')))
WHERE "slug" IS NULL;

ALTER TABLE "Category" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "displayName" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

-- Add categoryId to ServiceItem
ALTER TABLE "ServiceItem" ADD COLUMN IF NOT EXISTS "categoryId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceItem_categoryId_fkey'
  ) THEN
    ALTER TABLE "ServiceItem"
      ADD CONSTRAINT "ServiceItem_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add categoryId to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_categoryId_fkey'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
