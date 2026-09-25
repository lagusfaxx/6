import { addDays } from "@uzeed/shared";
import { config } from "../config";
import { getBillingSettingsSync, isBillingEnforced } from "./billingSettings";

type PlanUser = {
  profileType: string;
  tier?: string | null;
  tierExpiresAt?: Date | null;
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
export function isBusinessPlanActive(user: PlanUser): boolean {
  const requiresPayment = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType);
  if (!requiresPayment) return true;

  // Cobro apagado desde el panel (o en su periodo de gracia): todos visibles.
  const settings = getBillingSettingsSync();
  if (!isBillingEnforced(settings)) return true;

  const now = Date.now();

  // Active paid membership
  if (user.membershipExpiresAt && user.membershipExpiresAt.getTime() > now) {
    return true;
  }

  // Gold/Diamond asignado a mano por el equipo (sin vencimiento).
  if ((user.tier === "GOLD" || user.tier === "PREMIUM") && !user.tierExpiresAt) {
    return true;
  }

  // Active free trial
  if (user.shopTrialEndsAt && user.shopTrialEndsAt.getTime() > now) {
    return true;
  }

  // Grace period: all profiles get FREE_TRIAL_DAYS from their creation date,
  // regardless of whether shopTrialEndsAt or membershipExpiresAt are set.
  if (user.createdAt) {
    const gracePeriodMs = settings.trialDays * 24 * 60 * 60 * 1000;
    if (user.createdAt.getTime() + gracePeriodMs > now) {
      return true;
    }
  }

  return false;
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
  return addDays(new Date(), config.membershipDays);
}
