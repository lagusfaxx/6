import type { MarketProductType, Prisma } from "@prisma/client";

/**
 * Reglas para que un pack salga a la venta.
 *
 * - Los packs digitales (fotos o video) necesitan al menos una foto y un video
 *   de contenido: sin eso el cliente pagaría por un pack vacío o de una sola
 *   imagen.
 * - Todo pack nuevo, o al que le cambian la vitrina o el contenido, pasa por
 *   revisión antes de publicarse (que las fotos sean de ella y no sacadas de
 *   otro sitio). A la vendedora no se le dice que hay una revisión: ve su pack
 *   "procesando".
 */
export const DIGITAL_PACK_TYPES: MarketProductType[] = ["PHOTO_SET", "VIDEO"];

export const REVIEW_PENDING = "PENDING";
export const REVIEW_APPROVED = "APPROVED";
export const REVIEW_REJECTED = "REJECTED";

/** Condición de contenido mínimo, para usar dentro de un AND. */
export function packContentWhere(): Prisma.MarketProductWhereInput {
  return {
    OR: [
      { type: { notIn: DIGITAL_PACK_TYPES } },
      { AND: [{ assets: { some: { type: "IMAGE" } } }, { assets: { some: { type: "VIDEO" } } }] },
    ],
  };
}

/** Lo que el público puede ver y comprar. */
export function sellableProductWhere(): Prisma.MarketProductWhereInput {
  return {
    isActive: true,
    isHidden: false,
    reviewStatus: REVIEW_APPROVED,
    AND: [packContentWhere()],
  };
}

export function hasRequiredContent(type: MarketProductType, assets: { type: string }[]): boolean {
  if (!DIGITAL_PACK_TYPES.includes(type)) return true;
  return assets.some((a) => a.type === "IMAGE") && assets.some((a) => a.type === "VIDEO");
}

export function isSellable(
  product: { isActive: boolean; isHidden: boolean; reviewStatus: string; type: MarketProductType },
  assets: { type: string }[],
): boolean {
  return (
    product.isActive &&
    !product.isHidden &&
    product.reviewStatus === REVIEW_APPROVED &&
    hasRequiredContent(product.type, assets)
  );
}

/**
 * Estado que ve la vendedora. "processing" cubre la revisión sin nombrarla.
 *   incomplete    → le falta la foto o el video mínimo
 *   processing    → completo, todavía no publicado
 *   published     → a la venta
 *   not_published → no se aprobó
 *   paused        → ella lo pausó
 */
export function sellerPublishStatus(
  product: { isActive: boolean; isHidden: boolean; reviewStatus: string; type: MarketProductType },
  assets: { type: string }[],
): "incomplete" | "processing" | "published" | "not_published" | "paused" {
  if (!hasRequiredContent(product.type, assets)) return "incomplete";
  if (product.reviewStatus === REVIEW_REJECTED || product.isHidden) return "not_published";
  if (product.reviewStatus !== REVIEW_APPROVED) return "processing";
  if (!product.isActive) return "paused";
  return "published";
}
