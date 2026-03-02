-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFYING', 'PAID', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  "displayName" text,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "membershipExpiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Post" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "authorId" uuid,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "isPublic" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "postId" uuid NOT NULL,
  "type" "MediaType" NOT NULL,
  "url" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "provider" text NOT NULL DEFAULT 'khipu',
  "providerPaymentId" text NOT NULL UNIQUE,
  "transactionId" text NOT NULL UNIQUE,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'CLP',
  "paidAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Post_createdAt_idx" ON "Post"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER user_set_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TRIGGER post_set_updated_at BEFORE UPDATE ON "Post" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TRIGGER payment_set_updated_at BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null;
END $$;
