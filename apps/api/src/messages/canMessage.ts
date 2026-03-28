import { prisma } from "../db";

export async function canMessage(viewerId: string, targetId: string): Promise<boolean> {
  if (!viewerId || !targetId) return false;
  if (viewerId === targetId) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { profileType: true, allowFreeMessages: true }
  });
  if (!target) return false;

  if (target.profileType === "SHOP" || target.profileType === "PROFESSIONAL") return true;

  if (target.profileType === "CREATOR") {
    if (target.allowFreeMessages) return true;
    const subscription = await prisma.profileSubscription.findFirst({
      where: {
        subscriberId: viewerId,
        profileId: targetId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    });
    return !!subscription;
  }

  // Check U-Mate subscriptions (either direction: viewer subscribed to target's creator, or target subscribed to viewer's creator)
  const umateCreatorSub = await prisma.umateCreatorSub.findFirst({
    where: {
      expiresAt: { gt: new Date() },
      OR: [
        // viewer is subscribed to target (target is creator)
        {
          subscriberId: viewerId,
          creator: { userId: targetId },
        },
        // target is subscribed to viewer (viewer is creator)
        {
          subscriberId: targetId,
          creator: { userId: viewerId },
        },
      ],
    },
    select: { id: true },
  });
  if (umateCreatorSub) return true;

  const existingConversation = await prisma.message.findFirst({
    where: {
      OR: [
        { fromId: viewerId, toId: targetId },
        { fromId: targetId, toId: viewerId }
      ]
    },
    select: { id: true }
  });
  return !!existingConversation;
}
