import { addDays } from "@uzeed/shared";

type PlanUser = {
  profileType: string;
  membershipExpiresAt: Date | null;
  shopTrialEndsAt: Date | null;
};

export function isBusinessPlanActive(user: PlanUser): boolean {
  if (user.profileType !== "SHOP") return true;
  const now = Date.now();
  const membershipActive = user.membershipExpiresAt ? user.membershipExpiresAt.getTime() > now : false;
  const trialActive = user.shopTrialEndsAt ? user.shopTrialEndsAt.getTime() > now : false;
  return membershipActive || trialActive;
}

export function nextSubscriptionExpiry(): Date {
  return addDays(new Date(), 30);
}
