import type { Prisma } from "@prisma/client";
import type { BillingSettings } from "./billingSettings";
import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_REVIEWED_RECIPIENTS = 10_000;

export const reviewedRecipientsSchema = z.array(z.object({
  id: z.string().uuid(),
  email: z.string().email(),
})).min(1).max(MAX_REVIEWED_RECIPIENTS);

export type ReviewedRecipient = z.infer<typeof reviewedRecipientsSchema>[number];

/**
 * Complement of the public plan filter, restricted to approved professionals.
 * No cached billing settings: the caller must read them successfully from DB.
 * A missing enable date is ambiguous, so this campaign fails closed.
 */
export function expiredProfessionalsWhere(
  settings: BillingSettings,
  now = new Date(),
): Prisma.UserWhereInput | null {
  if (
    !settings.enabled || !settings.enabledAt ||
    !Number.isFinite(settings.enabledAt.getTime()) ||
    !Number.isFinite(settings.graceDays) || settings.graceDays < 0 ||
    !Number.isFinite(settings.trialDays) || settings.trialDays < 0 ||
    settings.enabledAt.getTime() + settings.graceDays * DAY_MS > now.getTime()
  ) return null;

  return {
    profileType: "PROFESSIONAL",
    isActive: true,
    isVerified: true,
    deletedAt: null,
    adminManaged: false,
    NOT: { email: { contains: "@placeholder.uzeed.cl", mode: "insensitive" } },
    createdAt: { lte: new Date(now.getTime() - settings.trialDays * DAY_MS) },
    AND: [
      { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
      { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
    ],
  };
}

/** Send only to the reviewed snapshot, rechecking account and billing each time. */
export async function sendExpiredProfessionalCampaign(
  reviewed: ReviewedRecipient[],
  deps: {
    loadSettings: () => Promise<BillingSettings>;
    findEligible: (recipient: ReviewedRecipient, where: Prisma.UserWhereInput) => Promise<boolean>;
    send: (email: string) => Promise<void>;
    now?: () => Date;
  },
) {
  const result = {
    total: reviewed.length, sent: 0, failed: 0, skipped: 0,
    notAttempted: 0, stopped: false,
  };
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (const recipient of reviewed) {
    const emailKey = recipient.email.toLowerCase();
    if (seenIds.has(recipient.id) || seenEmails.has(emailKey)) {
      result.skipped++;
      continue;
    }
    seenIds.add(recipient.id);
    seenEmails.add(emailKey);

    try {
      const where = expiredProfessionalsWhere(await deps.loadSettings(), deps.now?.() ?? new Date());
      if (!where) {
        result.skipped += result.total - result.sent - result.failed - result.skipped;
        break;
      }
      if (!await deps.findEligible(recipient, where)) {
        result.skipped++;
        continue;
      }
    } catch {
      // Never send using stale billing or account data after a failed DB read.
      result.stopped = true;
      result.notAttempted = result.total - result.sent - result.failed - result.skipped;
      break;
    }

    try {
      await deps.send(recipient.email);
      result.sent++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
