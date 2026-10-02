export type ProfessionalMeritLevel = "SILVER" | "GOLD" | "DIAMOND";

import type { ProfessionalTier } from "@prisma/client";
import type { ProfileMetrics } from "./profileRanking";

/**
 * Rango interno por tarifa (CLP). Ya no se vende: Gold y Diamond salen de la
 * tarifa del perfil; lo que se cobra son los boosts.
 *   SILVER  : menos de $50.000
 *   GOLD    : $50.000 – $99.999
 *   DIAMOND : $100.000 o más
 */
export const RATE_TIER_THRESHOLDS = {
  GOLD: 50_000,
  DIAMOND: 100_000,
} as const;

export function levelFromRate(rate: number | null | undefined): ProfessionalMeritLevel {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return "SILVER";
  if (r >= RATE_TIER_THRESHOLDS.DIAMOND) return "DIAMOND";
  if (r >= RATE_TIER_THRESHOLDS.GOLD) return "GOLD";
  return "SILVER";
}

/** Valor de `User.tier` para una tarifa. Sin tarifa queda sin rango. */
export function tierFromRate(rate: number | null | undefined): ProfessionalTier | null {
  const r = Number(rate);
  if (rate == null || !Number.isFinite(r) || r <= 0) return null;
  const level = levelFromRate(r);
  return level === "DIAMOND" ? "PREMIUM" : level;
}

/** Maps ProfessionalTier (DB) to the display merit level. */
const ADMIN_TIER_MAP: Record<string, ProfessionalMeritLevel> = {
  PREMIUM: "DIAMOND",
  GOLD: "GOLD",
  SILVER: "SILVER",
};

export interface ProfileMetricsWithTier extends ProfileMetrics {
  /** Tier guardado en la base (sincronizado con la tarifa). */
  adminTier?: string | null;
}

/**
 * Nivel del perfil: sale de la tarifa. Si quien llama no trae la tarifa, usa
 * el `tier` guardado, que la base mantiene sincronizado con ella.
 */
export function resolveProfessionalLevel(
  metrics: ProfileMetricsWithTier | number | null | undefined,
): ProfessionalMeritLevel {
  if (typeof metrics === "number" || metrics === null || metrics === undefined) {
    return "SILVER";
  }
  if (metrics.baseRate !== undefined) return levelFromRate(metrics.baseRate);
  if (metrics.adminTier && ADMIN_TIER_MAP[metrics.adminTier]) {
    return ADMIN_TIER_MAP[metrics.adminTier];
  }
  return "SILVER";
}

export function compareProfessionalLevelDesc(
  a: ProfessionalMeritLevel,
  b: ProfessionalMeritLevel,
) {
  const rank: Record<ProfessionalMeritLevel, number> = {
    DIAMOND: 3,
    GOLD: 2,
    SILVER: 1,
  };
  return rank[b] - rank[a];
}
