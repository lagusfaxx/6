/** Tipos y textos compartidos por las pantallas del marketplace. */

export type MarketProductType = "PHOTO_SET" | "VIDEO" | "CLOTHING" | "FETISH" | "CUSTOM" | "OTHER";
export type MarketDeliveryMethod = "DIGITAL" | "MEET" | "SHIPPING";
export type MarketOrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_REVIEW"
  | "PAID"
  | "PREPARING"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "REFUNDED"
  | "DISPUTED";

export type MarketSellerCard = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  city?: string | null;
  isVerified?: boolean;
  storeName?: string | null;
  tagline?: string | null;
};

export type MarketProductMedia = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  type: "IMAGE" | "VIDEO";
  pos: number;
};

export type MarketProduct = {
  id: string;
  title: string;
  description: string | null;
  priceClp: number;
  type: MarketProductType;
  deliveryMethods: MarketDeliveryMethod[];
  autoDeliver: boolean;
  stock: number | null;
  isActive: boolean;
  isHidden?: boolean;
  tags: string[];
  coverUrl: string | null;
  salesCount: number;
  viewCount: number;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
  assetCount?: number;
  orderCount?: number;
  media: MarketProductMedia[];
  seller: MarketSellerCard | null;
};

export type MarketOrder = {
  id: string;
  code: string;
  status: MarketOrderStatus;
  payoutStatus: "HELD" | "RELEASED" | "PAID" | "CANCELLED";
  productId: string | null;
  productTitle: string;
  unitPriceClp: number;
  quantity: number;
  itemTotalClp: number;
  shippingClp: number;
  totalClp: number;
  commissionClp?: number;
  sellerNetClp?: number;
  commissionPercent?: number;
  deliveryMethod: MarketDeliveryMethod;
  shippingRegion: string | null;
  shipAddress: string | null;
  shipCity: string | null;
  shipName: string | null;
  shipPhone: string | null;
  shipNotes: string | null;
  trackingCode: string | null;
  paymentMethod: "FLOW" | "TRANSFER";
  transferReceiptUrl?: string | null;
  paidAt: string | null;
  autoReleaseAt: string | null;
  deliveredAt: string | null;
  buyerConfirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  autoDelivered: boolean;
  disputedAt: string | null;
  disputeReason: string | null;
  disputeResolution: string | null;
  createdAt: string;
  assetCount: number;
  product: { id: string; coverUrl: string | null; type: MarketProductType } | null;
  buyer: MarketSellerCard | null;
  seller: MarketSellerCard | null;
};

export type MarketOrderAsset = {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string | null;
};

export type MarketTransferData = {
  bankName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  holderName: string | null;
  holderRut: string | null;
  email: string | null;
  note: string | null;
};

export type MarketConfig = {
  isEnabled: boolean;
  commissionPercent: number;
  holdDays: number;
  minPriceClp: number;
  maxPriceClp: number;
  gatewayEnabled: boolean;
  transferEnabled: boolean;
  shippingRates: Array<{ id: string; region: string; priceClp: number; etaText: string | null }>;
};

export const PRODUCT_TYPE_LABEL: Record<MarketProductType, string> = {
  PHOTO_SET: "Pack de fotos",
  VIDEO: "Video",
  CLOTHING: "Ropa usada",
  FETISH: "Fetiche",
  CUSTOM: "Personalizado",
  OTHER: "Otro",
};

export const PRODUCT_TYPE_EMOJI: Record<MarketProductType, string> = {
  PHOTO_SET: "📸",
  VIDEO: "🎬",
  CLOTHING: "👙",
  FETISH: "🔥",
  CUSTOM: "✨",
  OTHER: "🎁",
};

export const DELIVERY_LABEL: Record<MarketDeliveryMethod, string> = {
  DIGITAL: "Entrega digital",
  MEET: "Entrega acordada",
  SHIPPING: "Envío a domicilio",
};

export const DELIVERY_HINT: Record<MarketDeliveryMethod, string> = {
  DIGITAL: "Lo recibes dentro de UZEED, protegido y sin descargas.",
  MEET: "Coordinas la entrega directamente con la vendedora por el chat del pedido.",
  SHIPPING: "Se envía a tu dirección. El costo depende de tu región.",
};

export const ORDER_STATUS_UI: Record<MarketOrderStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: "Esperando pago", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  PAYMENT_REVIEW: { label: "Verificando pago", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  PAID: { label: "Pagado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
  PREPARING: { label: "En preparación", className: "border-blue-500/30 bg-blue-500/10 text-blue-200" },
  DELIVERED: { label: "Entregado", className: "border-violet-500/30 bg-violet-500/10 text-violet-200" },
  COMPLETED: { label: "Completado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
  CANCELLED: { label: "Cancelado", className: "border-white/15 bg-white/5 text-white/50" },
  REJECTED: { label: "Pago rechazado", className: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
  REFUNDED: { label: "Reembolsado", className: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
  DISPUTED: { label: "Reclamo abierto", className: "border-orange-500/30 bg-orange-500/10 text-orange-200" },
};

export function formatClp(value: number | null | undefined): string {
  return `$${Math.round(Number(value) || 0).toLocaleString("es-CL")}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** Cuánto falta para que se libere solo el pago retenido. */
export function timeUntil(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.round(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} días`;
}
