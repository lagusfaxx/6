-- Marketplace de UZEED: las profesionales venden artículos propios (fotos,
-- videos, ropa, fetiches) a sus clientes. El pago queda retenido hasta que la
-- clienta confirma la recepción o vencen los días de retención configurados.
-- Migración aditiva: no toca ninguna tabla existente.

-- CreateEnum
CREATE TYPE "MarketProductType" AS ENUM ('PHOTO_SET', 'VIDEO', 'CLOTHING', 'FETISH', 'CUSTOM', 'OTHER');
CREATE TYPE "MarketDeliveryMethod" AS ENUM ('DIGITAL', 'MEET', 'SHIPPING');
CREATE TYPE "MarketOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_REVIEW', 'PAID', 'PREPARING', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'REFUNDED', 'DISPUTED');
CREATE TYPE "MarketPayoutStatus" AS ENUM ('HELD', 'RELEASED', 'PAID', 'CANCELLED');
CREATE TYPE "MarketLedgerType" AS ENUM ('SALE', 'COMMISSION', 'RELEASE', 'REFUND', 'WITHDRAWAL', 'ADJUSTMENT');
CREATE TYPE "MarketWithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable
CREATE TABLE "MarketSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "holdDays" INTEGER NOT NULL DEFAULT 4,
    "minPriceClp" INTEGER NOT NULL DEFAULT 1000,
    "maxPriceClp" INTEGER NOT NULL DEFAULT 2000000,
    "gatewayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "transferEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "bankHolderName" TEXT,
    "bankHolderRut" TEXT,
    "bankEmail" TEXT,
    "transferNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketShippingRate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region" TEXT NOT NULL,
    "priceClp" INTEGER NOT NULL DEFAULT 0,
    "etaText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketShippingRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketShippingRate_region_key" ON "MarketShippingRate"("region");

-- CreateTable
CREATE TABLE "MarketSeller" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "storeName" TEXT,
    "tagline" TEXT,
    "bio" TEXT,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "acceptsShipping" BOOLEAN NOT NULL DEFAULT true,
    "acceptsMeet" BOOLEAN NOT NULL DEFAULT true,
    "autoDeliverDigital" BOOLEAN NOT NULL DEFAULT true,
    "bankName" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "bankHolderName" TEXT,
    "bankHolderRut" TEXT,
    "bankEmail" TEXT,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalEarnedClp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSeller_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketSeller_userId_key" ON "MarketSeller"("userId");
CREATE INDEX "MarketSeller_isActive_idx" ON "MarketSeller"("isActive");

-- CreateTable
CREATE TABLE "MarketProduct" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sellerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceClp" INTEGER NOT NULL,
    "type" "MarketProductType" NOT NULL DEFAULT 'PHOTO_SET',
    "deliveryMethods" "MarketDeliveryMethod"[] DEFAULT ARRAY[]::"MarketDeliveryMethod"[],
    "autoDeliver" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAvg" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketProduct_sellerId_idx" ON "MarketProduct"("sellerId");
CREATE INDEX "MarketProduct_userId_idx" ON "MarketProduct"("userId");
CREATE INDEX "MarketProduct_isActive_createdAt_idx" ON "MarketProduct"("isActive", "createdAt");
CREATE INDEX "MarketProduct_type_idx" ON "MarketProduct"("type");

-- CreateTable
CREATE TABLE "MarketProductMedia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "pos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketProductMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketProductMedia_productId_idx" ON "MarketProductMedia"("productId");

-- CreateTable
CREATE TABLE "MarketProductAsset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "pos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketProductAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketProductAsset_productId_idx" ON "MarketProductAsset"("productId");

-- CreateTable
CREATE TABLE "MarketOrder" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "productId" UUID,
    "productTitle" TEXT NOT NULL,
    "unitPriceClp" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemTotalClp" INTEGER NOT NULL,
    "shippingClp" INTEGER NOT NULL DEFAULT 0,
    "totalClp" INTEGER NOT NULL,
    "commissionClp" INTEGER NOT NULL DEFAULT 0,
    "sellerNetClp" INTEGER NOT NULL DEFAULT 0,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryMethod" "MarketDeliveryMethod" NOT NULL DEFAULT 'DIGITAL',
    "shippingRateId" UUID,
    "shippingRegion" TEXT,
    "shipAddress" TEXT,
    "shipCity" TEXT,
    "shipName" TEXT,
    "shipPhone" TEXT,
    "shipNotes" TEXT,
    "trackingCode" TEXT,
    "status" "MarketOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'FLOW',
    "paymentIntentId" UUID,
    "transferReceiptUrl" TEXT,
    "transferNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "autoReleaseAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "buyerConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "payoutStatus" "MarketPayoutStatus" NOT NULL DEFAULT 'HELD',
    "payoutPaidAt" TIMESTAMP(3),
    "autoDelivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketOrder_code_key" ON "MarketOrder"("code");
CREATE INDEX "MarketOrder_buyerId_createdAt_idx" ON "MarketOrder"("buyerId", "createdAt");
CREATE INDEX "MarketOrder_sellerId_createdAt_idx" ON "MarketOrder"("sellerId", "createdAt");
CREATE INDEX "MarketOrder_status_idx" ON "MarketOrder"("status");
CREATE INDEX "MarketOrder_autoReleaseAt_idx" ON "MarketOrder"("autoReleaseAt");

-- CreateTable
CREATE TABLE "MarketOrderAsset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "assetId" UUID,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOrderAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketOrderAsset_orderId_idx" ON "MarketOrderAsset"("orderId");

-- CreateTable
CREATE TABLE "MarketOrderEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketOrderEvent_orderId_createdAt_idx" ON "MarketOrderEvent"("orderId", "createdAt");

-- CreateTable
CREATE TABLE "MarketOrderMessage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOrderMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketOrderMessage_orderId_createdAt_idx" ON "MarketOrderMessage"("orderId", "createdAt");

-- CreateTable
CREATE TABLE "MarketLedgerEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "orderId" UUID,
    "type" "MarketLedgerType" NOT NULL,
    "amountClp" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketLedgerEntry_userId_createdAt_idx" ON "MarketLedgerEntry"("userId", "createdAt");
CREATE INDEX "MarketLedgerEntry_orderId_idx" ON "MarketLedgerEntry"("orderId");

-- CreateTable
CREATE TABLE "MarketWithdrawal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sellerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amountClp" INTEGER NOT NULL,
    "status" "MarketWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "bankSnapshot" JSONB,
    "adminNote" TEXT,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketWithdrawal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketWithdrawal_userId_createdAt_idx" ON "MarketWithdrawal"("userId", "createdAt");
CREATE INDEX "MarketWithdrawal_status_idx" ON "MarketWithdrawal"("status");

-- CreateTable
CREATE TABLE "MarketReview" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketReview_orderId_key" ON "MarketReview"("orderId");
CREATE INDEX "MarketReview_productId_createdAt_idx" ON "MarketReview"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketSeller" ADD CONSTRAINT "MarketSeller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketProduct" ADD CONSTRAINT "MarketProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "MarketSeller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketProduct" ADD CONSTRAINT "MarketProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketProductMedia" ADD CONSTRAINT "MarketProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketProductAsset" ADD CONSTRAINT "MarketProductAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_shippingRateId_fkey" FOREIGN KEY ("shippingRateId") REFERENCES "MarketShippingRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketOrderAsset" ADD CONSTRAINT "MarketOrderAsset_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrderAsset" ADD CONSTRAINT "MarketOrderAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MarketProductAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketOrderEvent" ADD CONSTRAINT "MarketOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrderMessage" ADD CONSTRAINT "MarketOrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketOrderMessage" ADD CONSTRAINT "MarketOrderMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketLedgerEntry" ADD CONSTRAINT "MarketLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketLedgerEntry" ADD CONSTRAINT "MarketLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketWithdrawal" ADD CONSTRAINT "MarketWithdrawal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "MarketSeller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketWithdrawal" ADD CONSTRAINT "MarketWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketReview" ADD CONSTRAINT "MarketReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tarifas de envío iniciales por región (editables desde el panel admin).
INSERT INTO "MarketShippingRate" ("region", "priceClp", "etaText", "updatedAt") VALUES
  ('Arica y Parinacota', 6990, '3 a 6 días hábiles', NOW()),
  ('Tarapacá', 6990, '3 a 6 días hábiles', NOW()),
  ('Antofagasta', 5990, '3 a 5 días hábiles', NOW()),
  ('Atacama', 5990, '3 a 5 días hábiles', NOW()),
  ('Coquimbo', 4990, '2 a 4 días hábiles', NOW()),
  ('Valparaíso', 3990, '1 a 3 días hábiles', NOW()),
  ('Metropolitana', 2990, '1 a 2 días hábiles', NOW()),
  ('O''Higgins', 3990, '2 a 3 días hábiles', NOW()),
  ('Maule', 4490, '2 a 4 días hábiles', NOW()),
  ('Ñuble', 4490, '2 a 4 días hábiles', NOW()),
  ('Biobío', 4490, '2 a 4 días hábiles', NOW()),
  ('Araucanía', 4990, '3 a 5 días hábiles', NOW()),
  ('Los Ríos', 5490, '3 a 5 días hábiles', NOW()),
  ('Los Lagos', 5490, '3 a 5 días hábiles', NOW()),
  ('Aysén', 7990, '5 a 8 días hábiles', NOW()),
  ('Magallanes', 7990, '5 a 8 días hábiles', NOW())
ON CONFLICT ("region") DO NOTHING;

-- Configuración por defecto del marketplace.
INSERT INTO "MarketSettings" ("id", "updatedAt") VALUES ('default', NOW())
ON CONFLICT ("id") DO NOTHING;
