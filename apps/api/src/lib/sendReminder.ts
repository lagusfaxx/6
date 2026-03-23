import { prisma } from "../db";
import { sendPushToUsers } from "../notifications/push";

/**
 * Send a reminder/notification through ALL channels:
 * 1. In-app notification (Notification model — visible in the bell icon)
 * 2. Push notification (Web Push — shows as a native OS notification)
 * 3. Email (handled separately by the caller via notificationEmail.ts)
 *
 * This ensures the professional sees the reminder even if she doesn't check email.
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
  // 1. In-app notification (persisted in DB, shown in notification center)
  await prisma.notification.create({
    data: {
      userId,
      type: opts.type as any,
      data: {
        title: opts.title,
        body: opts.body,
        url: opts.url,
      },
    },
  });

  // 2. Push notification (native OS notification via Web Push)
  await sendPushToUsers(prisma as any, [userId], {
    title: opts.title,
    body: opts.body,
    data: { url: opts.url },
    tag: opts.tag || opts.type,
  });
}
