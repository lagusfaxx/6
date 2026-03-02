-- Create per-shop product categories and relation from Product -> ShopCategory
CREATE TABLE IF NOT EXISTS "ShopCategory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shopCategoryId" uuid;

CREATE INDEX IF NOT EXISTS "ShopCategory_shopId_idx" ON "ShopCategory" ("shopId");
CREATE INDEX IF NOT EXISTS "Product_shopCategoryId_idx" ON "Product" ("shopCategoryId");

DO $$ BEGIN
  ALTER TABLE "ShopCategory" ADD CONSTRAINT "ShopCategory_shopId_slug_key" UNIQUE ("shopId", "slug");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShopCategory" ADD CONSTRAINT "ShopCategory_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_shopCategoryId_fkey"
    FOREIGN KEY ("shopCategoryId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
