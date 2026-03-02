-- Add enum values (idempotent via exception handling)
DO $$ BEGIN
  ALTER TYPE "ProfileType" ADD VALUE 'CLIENT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "ProfileType" ADD VALUE 'ESTABLISHMENT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure CategoryKind exists, then add SHOP (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema()
      AND (t.typname = 'CategoryKind' OR t.typname = 'categorykind')
  ) THEN
    CREATE TYPE "CategoryKind" AS ENUM ('PROFESSIONAL', 'ESTABLISHMENT', 'SHOP');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE (t.typname = 'CategoryKind' OR t.typname = 'categorykind')
      AND e.enumlabel = 'SHOP'
  ) THEN
    ALTER TYPE "CategoryKind" ADD VALUE 'SHOP';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Ensure ServiceRequestStatus exists with baseline values, then ensure APROBADO exists (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema()
      AND (t.typname = 'ServiceRequestStatus' OR t.typname = 'servicerequeststatus')
  ) THEN
    CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDIENTE_APROBACION', 'APROBADO', 'ACTIVO', 'PENDIENTE_EVALUACION', 'FINALIZADO');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE (t.typname = 'ServiceRequestStatus' OR t.typname = 'servicerequeststatus')
      AND e.enumlabel = 'APROBADO'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" ADD VALUE 'APROBADO';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentIntentPurpose" ADD VALUE 'MEMBERSHIP_PLAN';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Core discovery domain: Categories, Establishments, Favorites, Service Requests, Reviews
CREATE TABLE IF NOT EXISTS "Category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "kind" "CategoryKind" NOT NULL DEFAULT 'PROFESSIONAL',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Establishment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "categoryId" uuid NOT NULL,
  "name" text NOT NULL,
  "city" text NOT NULL,
  "address" text NOT NULL,
  "phone" text NOT NULL,
  "description" text,
  "latitude" double precision,
  "longitude" double precision,
  "galleryUrls" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "professionalId" uuid NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_professionalId_key" ON "Favorite"("userId","professionalId");

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" uuid NOT NULL,
  "professionalId" uuid NOT NULL,
  "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDIENTE_APROBACION',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ProfessionalReview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceRequestId" uuid NOT NULL,
  "hearts" integer NOT NULL,
  "comment" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfessionalReview_serviceRequestId_key" ON "ProfessionalReview"("serviceRequestId");

-- Foreign keys (defensive: add only if not exists)
DO $$ BEGIN
  ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProfessionalReview" ADD CONSTRAINT "ProfessionalReview_serviceRequestId_fkey"
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "categoryId" uuid;

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Sex Shop products
CREATE TABLE IF NOT EXISTS "Product" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shopId" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" integer NOT NULL,
  "stock" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ProductMedia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL,
  "url" text NOT NULL,
  "pos" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Motel/Establishment offers
CREATE TABLE IF NOT EXISTS "MotelRoom" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "establishmentId" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" integer NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MotelPack" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "establishmentId" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" integer NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MotelPromotion" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "establishmentId" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "discountPercent" integer,
  "startsAt" timestamp(3),
  "endsAt" timestamp(3),
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Establishment reviews (stars + comment)
CREATE TABLE IF NOT EXISTS "EstablishmentReview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "establishmentId" uuid NOT NULL,
  "clientId" uuid NOT NULL,
  "stars" integer NOT NULL,
  "comment" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Product_shopId_idx" ON "Product" ("shopId");
CREATE INDEX IF NOT EXISTS "ProductMedia_productId_idx" ON "ProductMedia" ("productId");
CREATE INDEX IF NOT EXISTS "MotelRoom_establishmentId_idx" ON "MotelRoom" ("establishmentId");
CREATE INDEX IF NOT EXISTS "MotelPack_establishmentId_idx" ON "MotelPack" ("establishmentId");
CREATE INDEX IF NOT EXISTS "MotelPromotion_establishmentId_idx" ON "MotelPromotion" ("establishmentId");

-- Uniqueness
DO $$ BEGIN
  ALTER TABLE "EstablishmentReview" ADD CONSTRAINT "EstablishmentReview_establishmentId_clientId_key" UNIQUE ("establishmentId","clientId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MotelRoom" ADD CONSTRAINT "MotelRoom_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MotelPack" ADD CONSTRAINT "MotelPack_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MotelPromotion" ADD CONSTRAINT "MotelPromotion_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstablishmentReview" ADD CONSTRAINT "EstablishmentReview_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstablishmentReview" ADD CONSTRAINT "EstablishmentReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
