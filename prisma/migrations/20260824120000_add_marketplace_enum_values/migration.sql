-- Valores de enum que usa el marketplace. Van en su propia migración porque
-- Postgres no permite usar un valor recién añadido dentro de la misma
-- transacción que lo crea.
ALTER TYPE "PaymentIntentPurpose" ADD VALUE IF NOT EXISTS 'MARKETPLACE_ORDER';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_NEW_ORDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_ORDER_PAID';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_ORDER_DELIVERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_ORDER_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_PAYOUT_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_ORDER_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MARKET_ORDER_CANCELLED';
