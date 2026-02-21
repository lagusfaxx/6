/**
 * Ranking utilities for the featured/discover endpoint.
 *
 * === Standard mode (small city / hybrid) ===
 * score = 0.20·recency + 0.20·popularity + 0.25·availability + 0.25·tier + 0.10·distance
 *
 * === VIP mode (city supply_count >= VIP_THRESHOLD) ===
 * score = 0.20·recency + 0.30·popularity + 0.20·availability + 0.25·tier + 0.05·distance
 *
 * Components:
 *   recency     = max(0, 1 - hoursSinceLastActive / 168)     [0..1]
 *   popularity  = min(1, profileViews / 500)                  [0..1]
 *   availability = availableNow ? 1.0 : 0.0                   [0..1]
 *   tier        = TIER_BOOST[tier] / 2.6                      [0.38..1]
 *   distance    = max(0, 1 - distanceKm / 50)                 [0..1], 0.5 if unknown
 *
 * Daily rotation noise (±10%) is added via deterministic hash(profileId + date)
 * to prevent ranking stagnation while keeping positions stable within a day.
 *
 * Anti-monopolization: Platinum profiles are capped in trending sections
 * (see MAX_PLATINUM_RATIO). This ensures mixed-tier visibility.
 *
 * VIP activation rule (backend, applied in /home/sections):
 *   if totalProfilesInCity >= VIP_THRESHOLD (25) → use computeVipRankingScore
 *   else → use computeRankingScore (more weight on distance + availability)
 */

/** Minimum supply count in a city to activate full VIP mode ranking */
export const VIP_THRESHOLD = 25;

/**
 * Maximum percentage of Platinum/Premium profiles in the "trending" section.
 * Prevents top-tier profiles from monopolizing the curated feed.
 * Both PLATINUM and PREMIUM (legacy equivalent) are counted together.
 * E.g. 0.4 = at most 40% of trending slots go to Platinum/Premium.
 */
export const MAX_PLATINUM_RATIO = 0.4;

const TIER_BOOST: Record<string, number> = {
  SILVER: 1.0,
  GOLD: 1.8,
  PREMIUM: 2.6,
  PLATINUM: 2.6,
};

/** Standard weights (sum = 1.0) */
const W_RECENCY = 0.20;
const W_POPULARITY = 0.20;
const W_AVAILABILITY = 0.25;
const W_TIER = 0.25;
const W_DISTANCE = 0.10;

/** Controls how much daily rotation affects ranking (±10%) */
const DAILY_ROTATION_NOISE_FACTOR = 0.1;

/**
 * Deterministic hash to produce a rotation noise value [0..1) per profile per day.
 */
function dailyNoise(profileId: string): number {
  const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const input = `${profileId}:${dayKey}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

export type RankingInput = {
  id: string;
  /** ISO timestamp or null */
  lastActiveAt: string | null;
  /** View count or similar */
  profileViews: number;
  /** Whether currently online / available */
  availableNow: boolean;
  /** DB tier value */
  tier: string | null;
  /** Distance in km from active_location (null if unknown) */
  distanceKm: number | null;
};

/* ── Internal scoring helpers ──────────────────────────── */

function scoreComponents(input: RankingInput) {
  const now = Date.now();
  const lastActive = input.lastActiveAt ? Date.parse(input.lastActiveAt) : 0;
  const hoursSinceActive = lastActive
    ? Math.max(0, (now - lastActive) / (3600 * 1000))
    : 168; // 1 week default
  const recency = Math.max(0, 1 - hoursSinceActive / 168);
  const popularity = Math.min(1, (input.profileViews || 0) / 500);
  const availability = input.availableNow ? 1.0 : 0.0;
  const rawTier = TIER_BOOST[input.tier?.toUpperCase() || "SILVER"] || 1.0;
  const tierNorm = rawTier / 2.6; // max tier = 1.0
  let distanceBoost = 0.5;
  if (input.distanceKm !== null) {
    distanceBoost = Math.max(0, 1 - input.distanceKm / 50);
  }
  return { recency, popularity, availability, tierNorm, distanceBoost };
}

/* ── VIP mode (city supply >= 25) ──────────────────────── */

const VIP_W_RECENCY = 0.20;
const VIP_W_POPULARITY = 0.30;
const VIP_W_AVAILABILITY = 0.20;
const VIP_W_TIER = 0.25;
const VIP_W_DISTANCE = 0.05;

export function computeVipRankingScore(input: RankingInput): number {
  const { recency, popularity, availability, tierNorm, distanceBoost } =
    scoreComponents(input);
  const baseScore =
    VIP_W_RECENCY * recency +
    VIP_W_POPULARITY * popularity +
    VIP_W_AVAILABILITY * availability +
    VIP_W_TIER * tierNorm +
    VIP_W_DISTANCE * distanceBoost;
  return baseScore + dailyNoise(input.id) * DAILY_ROTATION_NOISE_FACTOR;
}

/* ── Standard mode (small city / hybrid) ───────────────── */

export function computeRankingScore(input: RankingInput): number {
  const { recency, popularity, availability, tierNorm, distanceBoost } =
    scoreComponents(input);
  const baseScore =
    W_RECENCY * recency +
    W_POPULARITY * popularity +
    W_AVAILABILITY * availability +
    W_TIER * tierNorm +
    W_DISTANCE * distanceBoost;
  return baseScore + dailyNoise(input.id) * DAILY_ROTATION_NOISE_FACTOR;
}

/**
 * Select the appropriate scoring function based on supply count in the city.
 *
 *   supply >= VIP_THRESHOLD → VIP mode  (popularity-heavy, distance-light)
 *   supply < VIP_THRESHOLD  → standard  (distance-heavier, balanced)
 */
export function selectRankingFn(
  supplyCount: number,
): (input: RankingInput) => number {
  return supplyCount >= VIP_THRESHOLD
    ? computeVipRankingScore
    : computeRankingScore;
}

/**
 * Enforce anti-monopolization: cap the number of Platinum/Premium profiles
 * in a sorted list to MAX_PLATINUM_RATIO of total slots.
 *
 * Profiles beyond the cap are pushed to the end (not removed).
 */
export function capPlatinumInList<
  T extends { tier: string | null },
>(sorted: T[], maxSlots: number): T[] {
  const maxPlatinum = Math.max(1, Math.floor(maxSlots * MAX_PLATINUM_RATIO));
  const result: T[] = [];
  const overflow: T[] = [];
  let platCount = 0;

  for (const item of sorted) {
    const isPlatinum =
      item.tier === "PLATINUM" || item.tier === "PREMIUM";
    if (isPlatinum && platCount >= maxPlatinum) {
      overflow.push(item);
    } else {
      if (isPlatinum) platCount++;
      result.push(item);
    }
  }
  return [...result, ...overflow].slice(0, maxSlots);
}
