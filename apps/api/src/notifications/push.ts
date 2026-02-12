import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";

let isConfigured = false;

function configureWebPush() {
  if (isConfigured) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  return true;
}

export async function savePushSubscription(
  prisma: PrismaClient,
  userId: string,
  rawSubscription: any,
  userAgent?: string
) {
  const endpoint = String(rawSubscription?.endpoint || "").trim();
  const p256dh = String(rawSubscription?.keys?.p256dh || "").trim();
  const auth = String(rawSubscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("INVALID_PUSH_SUBSCRIPTION");
  }

  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth, userAgent },
    update: { userId, p256dh, auth, userAgent }
  });
}

export async function removePushSubscription(prisma: PrismaClient, userId: string, endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function sendPushToUsers(
  prisma: PrismaClient,
  userIds: string[],
  payload: { title: string; body: string; data?: Record<string, any>; tag?: string }
) {
  if (!configureWebPush()) return;
  if (!userIds.length) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(userIds)] } }
  });

  await Promise.all(
    subscriptions.map(async (subscription: any) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
        }
      }
    })
  );
}
