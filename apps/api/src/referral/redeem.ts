import { prisma } from "../db";

/**
 * Redeem a referral code for a newly registered professional.
 * Creates a PENDING redemption — it only counts toward the cycle
 * once the professional meets all validation conditions:
 *   1. Profile verified (isVerified = true)
 *   2. Has at least 1 photo (avatar or gallery)
 *   3. Account active for 48h+
 *
 * The worker tick checks pending redemptions and validates them.
 */
export async function redeemReferralCode(
  code: string,
  professionalId: string,
): Promise<void> {
  // 1. Find the referral code
  const referralCode = await prisma.creatorReferralCode.findUnique({
    where: { code },
  });

  if (!referralCode || !referralCode.isActive) return;

  // 2. Prevent self-referral
  if (referralCode.creatorId === professionalId) return;

  // 3. Check if professional already redeemed any code
  const alreadyRedeemed = await prisma.referralRedemption.findUnique({
    where: { professionalId },
  });
  if (alreadyRedeemed) return;

  // 4. Find or create the active cycle for this referral code
  let activeCycle = await prisma.referralCycle.findFirst({
    where: {
      referralCodeId: referralCode.id,
      status: "ACTIVE",
    },
    orderBy: { cycleStart: "desc" },
  });

  if (!activeCycle) {
    const now = new Date();
    const cycleEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    activeCycle = await prisma.referralCycle.create({
      data: {
        referralCodeId: referralCode.id,
        cycleStart: now,
        cycleEnd,
        status: "ACTIVE",
      },
    });
  }

  // 5. Create PENDING redemption — does NOT count toward cycle yet
  await prisma.referralRedemption.create({
    data: {
      referralCodeId: referralCode.id,
      cycleId: activeCycle.id,
      professionalId,
      amountCLP: 10_000,
      status: "PENDING",
    },
  });
}

/**
 * Check all PENDING redemptions and validate those that meet conditions.
 * Called by the worker on a schedule.
 */
export async function validatePendingRedemptions(): Promise<number> {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Find all PENDING redemptions
  const pending = await prisma.referralRedemption.findMany({
    where: { status: "PENDING" },
    include: {
      professional: {
        select: {
          id: true,
          isVerified: true,
          avatarUrl: true,
          coverUrl: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
    take: 200,
  });

  let validatedCount = 0;

  for (const redemption of pending) {
    const prof = redemption.professional;

    // Check each condition
    const isActive48h = prof.createdAt.getTime() <= fortyEightHoursAgo.getTime();
    const isVerified = prof.isVerified;

    // Check photos: avatar, cover, or gallery media
    let hasPhoto = !!(prof.avatarUrl || prof.coverUrl);
    if (!hasPhoto) {
      const mediaCount = await prisma.profileMedia.count({
        where: { ownerId: prof.id, type: "IMAGE" },
      });
      hasPhoto = mediaCount > 0;
    }

    // Update condition tracking
    const updates: any = {
      hasPhoto,
      isVerified,
      isActive48h,
    };

    // All conditions met → VALIDATED
    if (hasPhoto && isVerified && isActive48h) {
      updates.status = "VALIDATED";
      updates.validatedAt = now;

      await prisma.referralRedemption.update({
        where: { id: redemption.id },
        data: updates,
      });

      // Increment the cycle counter (only validated redemptions count)
      if (redemption.cycleId) {
        await prisma.referralCycle.update({
          where: { id: redemption.cycleId },
          data: { totalReferrals: { increment: 1 } },
        });
      }

      validatedCount++;
    } else {
      // Just update the condition flags so the creator can see progress
      await prisma.referralRedemption.update({
        where: { id: redemption.id },
        data: updates,
      });
    }

    // If the professional's account was deactivated, reject the redemption
    if (!prof.isActive) {
      await prisma.referralRedemption.update({
        where: { id: redemption.id },
        data: { status: "REJECTED" },
      });
    }
  }

  return validatedCount;
}
