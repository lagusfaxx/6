import crypto from "node:crypto";
import type { Request, Response } from "express";

import { config } from "../config";
import {
  PRIVATE_PREFIX,
  isPrivateRef,
  privateRefToRelPath,
  savePrivate,
  streamPrivateFile,
} from "../umate/privateStorage";

export { PRIVATE_PREFIX, isPrivateRef, privateRefToRelPath, savePrivate };

/** Carpeta dentro del almacenamiento privado para los archivos vendidos. */
export const MARKET_ASSET_FOLDER = "market-assets";

/* Los archivos que compra la clienta se sirven con una URL firmada de vida
   corta: no hay enlace permanente que se pueda pegar en otro sitio, y la
   firma caduca aunque alguien copie la URL desde el inspector. */
const ASSET_TTL_SECONDS = 15 * 60;

function payload(subject: string, exp: number): string {
  return `market-media\0${subject}\0${exp}`;
}

/** Origen del archivo firmado: el entregado en un pedido o el maestro del artículo. */
export type MediaScope = "order" | "product";

function subjectOf(scope: MediaScope, id: string, kind: "asset" | "thumb"): string {
  // El ámbito "order" no lleva prefijo: las firmas ya emitidas siguen valiendo.
  return scope === "order" ? `${id}:${kind}` : `${scope}:${id}:${kind}`;
}

function sign(subject: string, ttlSeconds = ASSET_TTL_SECONDS): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(payload(subject, exp))
    .digest("base64url");
  return { exp, sig };
}

function verify(subject: string, exp: number, sig: string | null | undefined): boolean {
  if (!sig || !Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(payload(subject, exp))
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** URL firmada para un archivo entregado en un pedido. */
export function buildOrderAssetUrl(orderAssetId: string, kind: "asset" | "thumb"): string {
  return buildSignedMediaUrl("order", orderAssetId, kind);
}

/** URL firmada para el archivo maestro del artículo (uso interno: administración). */
export function buildProductAssetUrl(productAssetId: string, kind: "asset" | "thumb"): string {
  return buildSignedMediaUrl("product", productAssetId, kind);
}

export function buildSignedMediaUrl(scope: MediaScope, assetId: string, kind: "asset" | "thumb"): string {
  const { exp, sig } = sign(subjectOf(scope, assetId, kind));
  const base = (config.apiUrl || "").replace(/\/$/, "");
  const path = scope === "order" ? `/market/media/${assetId}` : `/market/media/product/${assetId}`;
  const suffix = kind === "thumb" ? "/thumb" : "";
  return `${base}${path}${suffix}?exp=${exp}&sig=${sig}`;
}

export function verifyOrderAssetSignature(orderAssetId: string, kind: "asset" | "thumb", exp: number, sig: string | null | undefined): boolean {
  return verify(subjectOf("order", orderAssetId, kind), exp, sig);
}

export function verifyMediaSignature(scope: MediaScope, assetId: string, kind: "asset" | "thumb", exp: number, sig: string | null | undefined): boolean {
  return verify(subjectOf(scope, assetId, kind), exp, sig);
}

/**
 * Entrega el archivo privado. Se añaden cabeceras que evitan que el navegador
 * lo trate como descarga o lo guarde en caché compartida; la protección real
 * contra la copia es la firma corta más la marca de agua del visor.
 */
export async function streamOrderAsset(relPath: string, req: Request, res: Response): Promise<void> {
  res.setHeader("X-Robots-Tag", "noindex, noimageindex, noarchive");
  await streamPrivateFile(relPath, req, res);
}
