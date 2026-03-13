import { compareProfessionalLevelDesc, type ProfessionalTier } from "./profileRanking";

export type ProfessionalMeritLevel = ProfessionalTier;

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

export { compareProfessionalLevelDesc };
