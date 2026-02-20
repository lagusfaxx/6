/**
 * Ranking utilities for the featured/discover endpoint.
 *
 * score = w1*recency + w2*popularity + w3*availability + w4*tier_boost + w5*distance_boost
 *
 * Uses deterministic daily rotation noise so the same profiles don't always
 * appear at the top.
 */

const TIER_BOOST: Record<string, number> = {
  SILVER: 1.0,
  GOLD: 1.8,
  PREMIUM: 2.6,
  PLATINUM: 2.6,
};

/** Weights must sum to 1.0 for normalized scoring */
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

export function computeRankingScore(input: RankingInput): number {
  const now = Date.now();

  // Recency: how recently active (0..1, 1 = active now)
  const lastActive = input.lastActiveAt
    ? Date.parse(input.lastActiveAt)
    : 0;
  const hoursSinceActive = lastActive
    ? Math.max(0, (now - lastActive) / (3600 * 1000))
    : 168; // 1 week default
  const recency = Math.max(0, 1 - hoursSinceActive / 168);

  // Popularity: normalized by a reference value
  const popularity = Math.min(1, (input.profileViews || 0) / 500);

  // Availability boost
  const availability = input.availableNow ? 1.0 : 0.0;

  // Tier boost (normalized to 0..1 range)
  const rawTier = TIER_BOOST[input.tier?.toUpperCase() || "SILVER"] || 1.0;
  const tierNorm = rawTier / 2.6; // max tier = 1.0

  // Distance boost (closer = higher, null = neutral)
  let distanceBoost = 0.5;
  if (input.distanceKm !== null) {
    distanceBoost = Math.max(0, 1 - input.distanceKm / 50);
  }

  const baseScore =
    W_RECENCY * recency +
    W_POPULARITY * popularity +
    W_AVAILABILITY * availability +
    W_TIER * tierNorm +
    W_DISTANCE * distanceBoost;

  // Add daily rotation noise to prevent stagnant positions
  const noise = dailyNoise(input.id) * DAILY_ROTATION_NOISE_FACTOR;

  return baseScore + noise;
}
