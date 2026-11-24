import { useEffect, useState } from "react";
import { apiFetch } from "./api";

/**
 * Datos públicos que se configuran desde el panel (/admin/cobros) y no al
 * compilar la web: los días de prueba gratis y la clave del captcha del
 * registro. Antes el texto "3 meses gratis" venía de NEXT_PUBLIC_FREE_TRIAL_DAYS
 * y no cambiaba al cambiar la prueba en el panel.
 */
export type PublicConfig = {
  billingEnabled: boolean;
  trialDays: number;
  turnstileSiteKey: string | null;
};

let cached: PublicConfig | null = null;
let inflight: Promise<PublicConfig | null> | null = null;

export function loadPublicConfig(): Promise<PublicConfig | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = apiFetch<PublicConfig>("/billing/public-config")
      .then((c) => {
        cached = c;
        return c;
      })
      .catch(() => {
        inflight = null;
        return null;
      });
  }
  return inflight;
}

export function usePublicConfig(): PublicConfig | null {
  const [config, setConfig] = useState<PublicConfig | null>(cached);
  useEffect(() => {
    let alive = true;
    loadPublicConfig().then((c) => {
      if (alive && c) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return config;
}

export function trialLabel(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
  if (days >= 30) return `${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `${days} días`;
}

/**
 * Texto de la prueba gratis según el panel. Mientras carga (o si la API no
 * responde) dice "Prueba gratis", sin número: nunca promete días de más.
 */
export function useTrialText(): { label: string | null; text: string } {
  const config = usePublicConfig();
  if (!config || !Number.isFinite(config.trialDays) || config.trialDays <= 0) {
    return { label: null, text: "Prueba gratis" };
  }
  const label = trialLabel(config.trialDays);
  return { label, text: `${label} gratis` };
}

/** Marca en las opciones fijas del registro: se reemplaza por `useTrialText`. */
export const TRIAL_BADGE = "__trial__";
