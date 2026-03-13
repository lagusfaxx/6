export type ProfessionalMeritLevel = "SILVER" | "GOLD" | "DIAMOND";

export function resolveProfessionalLevel(
  totalEarnedClp: number | null | undefined,
): ProfessionalMeritLevel {
  const value = Number.isFinite(Number(totalEarnedClp))
    ? Number(totalEarnedClp)
    : 0;
  if (value > 140_000) return "DIAMOND";
  if (value >= 90_000) return "GOLD";
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
