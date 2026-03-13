export type ProfessionalTier = "SILVER" | "GOLD" | "DIAMOND";

// Ranking formula: score = price + views + recentActivity + completedServices.
export const PROFILE_RANKING = {
  price: [
    { min: 140_000, points: 60 },
    { min: 100_000, points: 45 },
    { min: 70_000, points: 30 },
    { min: 40_000, points: 15 },
    { min: 1, points: 5 },
  ],
  views: [
    { min: 3_000, points: 65 },
    { min: 1_000, points: 50 },
    { min: 500, points: 35 },
    { min: 200, points: 20 },
    { min: 50, points: 10 },
  ],
  activity: [
    { maxDays: 1, points: 50 },
    { maxDays: 3, points: 35 },
    { maxDays: 7, points: 20 },
    { maxDays: 15, points: 10 },
  ],
  completedServices: [
    { min: 60, points: 70 },
    { min: 30, points: 55 },
    { min: 15, points: 40 },
    { min: 5, points: 25 },
    { min: 1, points: 10 },
  ],
  tiers: {
    GOLD_MIN: 60,
    DIAMOND_MIN: 130,
  },
} as const;

function toSafeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getPriceScore(price: unknown): number {
  const amount = toSafeNumber(price);
  if (amount <= 0) return 0;
  return PROFILE_RANKING.price.find((rule) => amount >= rule.min)?.points ?? 0;
}

export function getViewsScore(views: unknown): number {
  const count = Math.max(0, Math.floor(toSafeNumber(views)));
  return PROFILE_RANKING.views.find((rule) => count >= rule.min)?.points ?? 0;
}

export function getActivityScore(lastActiveAt: Date | string | null | undefined): number {
  if (!lastActiveAt) return 0;
  const ts = lastActiveAt instanceof Date ? lastActiveAt.getTime() : Date.parse(String(lastActiveAt));
  if (!Number.isFinite(ts)) return 0;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return PROFILE_RANKING.activity[0]?.points ?? 0;
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return PROFILE_RANKING.activity.find((rule) => diffDays <= rule.maxDays)?.points ?? 0;
}

export function getCompletedServicesScore(completedCount: unknown): number {
  const count = Math.max(0, Math.floor(toSafeNumber(completedCount)));
  return (
    PROFILE_RANKING.completedServices.find((rule) => count >= rule.min)?.points ??
    0
  );
}

export function getTierFromScore(score: unknown): ProfessionalTier {
  const total = Math.max(0, Math.floor(toSafeNumber(score)));
  if (total >= PROFILE_RANKING.tiers.DIAMOND_MIN) return "DIAMOND";
  if (total >= PROFILE_RANKING.tiers.GOLD_MIN) return "GOLD";
  return "SILVER";
}

export function getProfileRanking(input: {
  baseRate?: unknown;
  profileViews?: unknown;
  lastActiveAt?: Date | string | null;
  completedServices?: unknown;
}) {
  const priceScore = getPriceScore(input.baseRate);
  const viewsScore = getViewsScore(input.profileViews);
  const activityScore = getActivityScore(input.lastActiveAt);
  const completedServicesScore = getCompletedServicesScore(input.completedServices);
  const profileScore = priceScore + viewsScore + activityScore + completedServicesScore;

  return {
    priceScore,
    viewsScore,
    activityScore,
    completedServicesScore,
    profileScore,
    calculatedTier: getTierFromScore(profileScore),
  };
}

export function compareProfessionalLevelDesc(
  a: ProfessionalTier,
  b: ProfessionalTier,
) {
  const rank: Record<ProfessionalTier, number> = {
    DIAMOND: 3,
    GOLD: 2,
    SILVER: 1,
  };
  return rank[b] - rank[a];
}
