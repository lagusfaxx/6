export type ProfessionalMeritLevel = "SILVER" | "GOLD" | "DIAMOND";

import {
  calculateProfileScore,
  getTierFromScore,
  type ProfileMetrics,
} from "./profileRanking";

/**
 * Score-based professional level resolver.
 * Uses real profile metrics: price, views, activity, completed services.
 * Accepts either a ProfileMetrics object or a single number (backward compat).
 */
export function resolveProfessionalLevel(
  metrics: ProfileMetrics | number | null | undefined,
): ProfessionalMeritLevel {
  if (typeof metrics === "number" || metrics === null || metrics === undefined) {
    return getTierFromScore(
      calculateProfileScore({ completedServices: metrics as number | null }),
    );
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
