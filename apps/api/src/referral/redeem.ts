import { prisma } from "../db";

/**
 * Redeem a referral code for a newly registered professional.
 * Called during registration — must be non-blocking (errors are caught by caller).
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
    // Create a new cycle
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

  // 5. Create redemption record
  await prisma.referralRedemption.create({
    data: {
      referralCodeId: referralCode.id,
      cycleId: activeCycle.id,
      professionalId,
      amountCLP: 10_000,
    },
  });

  // 6. Increment cycle counter
  await prisma.referralCycle.update({
    where: { id: activeCycle.id },
    data: { totalReferrals: { increment: 1 } },
  });
}
