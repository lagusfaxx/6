/**
 * Creator Referral Payout Calculator
 *
 * Base: $10,000 CLP per referred professional
 * Minimum: 10 referrals to qualify for payment
 * Cycle: 20 days, resets on day 21
 *
 * Bonus tiers (cumulative):
 *   15+ referrals → +$50,000 CLP bonus
 *   20+ referrals → +$100,000 CLP bonus
 *   30+ referrals → +$200,000 CLP bonus
 *
 * Examples:
 *   10 referrals = 100,000 CLP
 *   11 referrals = 110,000 CLP
 *   15 referrals = 150,000 + 50,000 = 200,000 CLP
 *   20 referrals = 200,000 + 50,000 + 100,000 = 350,000 CLP
 *   30 referrals = 300,000 + 50,000 + 100,000 + 200,000 = 650,000 CLP
 */

const PER_REFERRAL_CLP = 10_000;
const MIN_REFERRALS = 10;

const BONUS_TIERS = [
  { min: 30, bonus: 200_000 },
  { min: 20, bonus: 100_000 },
  { min: 15, bonus: 50_000 },
];

export function calculateReferralPayout(referralCount: number) {
  if (referralCount < MIN_REFERRALS) {
    return {
      qualifies: false,
      baseAmount: 0,
      bonusAmount: 0,
      totalAmount: 0,
      referralsNeeded: MIN_REFERRALS - referralCount,
      nextBonusTier: MIN_REFERRALS,
      nextBonusAmount: MIN_REFERRALS * PER_REFERRAL_CLP,
    };
  }

  const baseAmount = referralCount * PER_REFERRAL_CLP;

  // Calculate cumulative bonuses
  let bonusAmount = 0;
  for (const tier of BONUS_TIERS) {
    if (referralCount >= tier.min) {
      bonusAmount += tier.bonus;
    }
  }

  const totalAmount = baseAmount + bonusAmount;

  // Find next bonus tier
  const sortedTiers = [...BONUS_TIERS].sort((a, b) => a.min - b.min);
  const nextTier = sortedTiers.find((t) => referralCount < t.min);

  return {
    qualifies: true,
    baseAmount,
    bonusAmount,
    totalAmount,
    referralsNeeded: 0,
    nextBonusTier: nextTier?.min || null,
    nextBonusAmount: nextTier
      ? nextTier.min * PER_REFERRAL_CLP + bonusAmount + nextTier.bonus
      : null,
  };
}
