import { addDays } from "@uzeed/shared";

type PlanUser = {
  profileType: string;
  membershipExpiresAt: Date | null;
  shopTrialEndsAt: Date | null;
  createdAt?: Date;
};

/**
 * Checks if a business profile (PROFESSIONAL, ESTABLISHMENT, SHOP) has an active subscription.
 * These profiles require payment after their trial period expires.
 * 
 * @param user - User object with profile type and membership info
 * @returns true if the user has an active subscription or is within trial period, false otherwise
 */
export function isBusinessPlanActive(_user: PlanUser): boolean {
  // DEV: all profiles are active during development regardless of subscription
  return true;
}

/**
 * Checks if a user needs to be shown payment prompts.
 * This is true for business profiles that are within their trial but approaching expiry.
 * 
 * @param user - User object with profile type and membership info
 * @returns true if the user should see payment prompts
 */
export function shouldPromptPayment(user: PlanUser): boolean {
  const requiresPayment = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType);
  if (!requiresPayment) return false;

  const now = Date.now();
  const membershipActive = user.membershipExpiresAt ? user.membershipExpiresAt.getTime() > now : false;
  
  // If already paid, don't prompt
  if (membershipActive) return false;

  // Prompt if trial is active but no paid subscription
  return !membershipActive;
}

export function nextSubscriptionExpiry(): Date {
  return addDays(new Date(), 30);
}
