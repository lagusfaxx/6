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
  if (!configureWebPush()) {
    return { attempted: 0, results: [], error: "WEBPUSH_NOT_CONFIGURED" };
  }
  if (!userIds.length) return { attempted: 0, results: [] };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(userIds)] } }
  });

  const results = await Promise.all(
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
        return { endpoint: subscription.endpoint, ok: true };
      } catch (err: any) {
        // IMPORTANT: iOS push services can reject requests for strict reasons
        // (VAPID subject/keys, headers). Log the failure so we don't fail silently.
        console.error("[webpush] send failed", {
          statusCode: err?.statusCode,
          body: err?.body,
          endpointHost: (() => {
            try {
              return new URL(String(subscription.endpoint)).host;
            } catch {
              return "invalid";
            }
          })()
        });
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
        }
        return { endpoint: subscription.endpoint, ok: false, statusCode: err?.statusCode };
      }
    })
  );

  return { attempted: subscriptions.length, results };
}
