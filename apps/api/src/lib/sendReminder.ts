import { prisma } from "../db";

/**
 * Send a reminder/notification through ALL channels:
 * 1. In-app notification (Notification model — visible in the bell icon)
 * 2. Push notification — triggered automatically by the Prisma middleware in db.ts
 * 3. Email (handled separately by the caller via notificationEmail.ts)
 *
 * NOTE: Do NOT call sendPushToUsers here — the Prisma middleware on
 * Notification.create already dispatches a push for every new notification.
 * Calling it here would result in duplicate push notifications.
 */
export async function sendInAppAndPush(
  userId: string,
  opts: {
    type: string;
    title: string;
    body: string;
    url: string;
    tag?: string;
  },
) {
  await prisma.notification.create({
    data: {
      userId,
      type: opts.type as import("@prisma/client").NotificationType,
      data: {
        title: opts.title,
        body: opts.body,
        url: opts.url,
        tag: opts.tag || opts.type,
      },
    },
  });
}
