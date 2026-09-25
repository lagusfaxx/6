"use client";

import { useEffect, useState } from "react";
import { cachedApiFetch } from "../lib/api";

export type CatalogProduct = {
  id: string;
  kind: "PLAN" | "BOOST";
  code: "SILVER" | "GOLD" | "DIAMOND" | "BUMP" | "SPOTLIGHT";
  name: string;
  description: string | null;
  duration: number;
  priceClp: number;
  tokens: number;
};

export type BillingInfo = {
  /** Interruptor de cobro del panel. Apagado = publicar es gratis y sin vencimiento. */
  billingEnabled: boolean;
  /** Días de prueba gratis de un perfil nuevo (sólo importan con el cobro encendido). */
  trialDays: number;
  flowAvailable: boolean;
  products: CatalogProduct[];
};

/**
 * Estado del cobro y catálogo de planes, leído del servidor (no de variables
 * de build, que podían no coincidir con la API). Mientras carga devuelve null:
 * quien lo use debe asumir "gratis" hasta saber otra cosa.
 */
export default function useBillingInfo(): BillingInfo | null {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  useEffect(() => {
    let alive = true;
    cachedApiFetch<BillingInfo>("/promo/catalog", 60_000)
      .then((r) => {
        if (alive) {
          setInfo({
            billingEnabled: Boolean(r.billingEnabled),
            trialDays: Number(r.trialDays ?? 0),
            flowAvailable: Boolean(r.flowAvailable),
            products: Array.isArray(r.products) ? r.products : [],
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

export function trialLabel(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
  if (days >= 30) return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `${days} días`;
}

/** Texto de la promo para profesionales: "Gratis" o "6 meses gratis". */
export function promoText(info: BillingInfo | null): string {
  if (!info || !info.billingEnabled) return "Gratis";
  if (info.trialDays <= 0) return "Planes desde $" + minPlanPrice(info).toLocaleString("es-CL");
  return `${trialLabel(info.trialDays)} gratis`;
}

function minPlanPrice(info: BillingInfo) {
  const prices = info.products.filter((p) => p.kind === "PLAN").map((p) => p.priceClp);
  return prices.length ? Math.min(...prices) : 0;
}
