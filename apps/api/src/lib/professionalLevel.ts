export type ProfessionalMeritLevel = "SILVER" | "GOLD" | "DIAMOND";

import {
  calculateProfileScore,
  getTierFromScore,
  type ProfileMetrics,
} from "./profileRanking";

/** Maps admin-set ProfessionalTier (DB) to the display merit level. */
const ADMIN_TIER_MAP: Record<string, ProfessionalMeritLevel> = {
  PREMIUM: "DIAMOND",
  GOLD: "GOLD",
  SILVER: "SILVER",
};

export interface ProfileMetricsWithTier extends ProfileMetrics {
  /** Admin-set tier from DB (ProfessionalTier enum). Overrides computed level. */
  adminTier?: string | null;
}

/**
 * Score-based professional level resolver.
 * If an admin-set tier exists, it takes priority over the computed score.
 * Uses real profile metrics: price, views, activity, completed services.
 * Accepts either a ProfileMetricsWithTier object or a single number (backward compat).
 */
export function resolveProfessionalLevel(
  metrics: ProfileMetricsWithTier | number | null | undefined,
): ProfessionalMeritLevel {
  if (typeof metrics === "number" || metrics === null || metrics === undefined) {
    return getTierFromScore(
      calculateProfileScore({ completedServices: metrics as number | null }),
    );
  }
  // Admin-set tier overrides computed level
  if (metrics.adminTier && ADMIN_TIER_MAP[metrics.adminTier]) {
    return ADMIN_TIER_MAP[metrics.adminTier];
  }
  return getTierFromScore(calculateProfileScore(metrics));
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
