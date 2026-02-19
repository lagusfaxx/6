export type ProfessionalMeritLevel = "SILVER" | "GOLD" | "DIAMOND"; // DIAMOND se presenta como Platinum en UI

export function resolveProfessionalLevel(
  completedServices: number | null | undefined,
): ProfessionalMeritLevel {
  const total = Number.isFinite(Number(completedServices))
    ? Number(completedServices)
    : 0;
  if (total > 20) return "DIAMOND"; // Platinum
  if (total >= 10) return "GOLD";
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
