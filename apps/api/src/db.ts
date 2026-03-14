import { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./notifications/push";

export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"]
});

let _insidePushMiddleware = false;

prisma.$use(async (params, next) => {
  const result = await next(params);

  if (params.model !== "Notification" || _insidePushMiddleware) {
    return result;
  }

  _insidePushMiddleware = true;
  try {
    if (params.action === "create") {
      const data = params.args?.data;
      const userId = data?.userId;
      const payloadData = (data?.data && typeof data.data === "object") ? data.data : {};
      if (userId) {
        await sendPushToUsers(prisma as any, [userId], {
          title: payloadData.title || "UZEED",
          body: payloadData.body || "Tienes una nueva notificación",
          data: { ...payloadData, url: payloadData.url || "/" },
          tag: data?.type || "uzeed-notification"
        }).catch((err) => {
          console.error("[push-middleware] sendPush failed for create:", err?.message || err);
        });
      }
    }

    if (params.action === "createMany") {
      const records = params.args?.data;
      if (Array.isArray(records) && records.length > 0) {
        const pushPromises = records
          .filter((item: any) => item?.userId)
          .map((item: any) => {
            const payloadData = (item?.data && typeof item.data === "object") ? item.data : {};
            return sendPushToUsers(prisma as any, [item.userId], {
              title: payloadData.title || "UZEED",
              body: payloadData.body || "Tienes una nueva notificación",
              data: { ...payloadData, url: payloadData.url || "/" },
              tag: item?.type || "uzeed-notification"
            }).catch((err) => {
              console.error("[push-middleware] sendPush failed for createMany item:", err?.message || err);
            });
          });
        await Promise.allSettled(pushPromises);
      }
    }
  } finally {
    _insidePushMiddleware = false;
  }

  return result;
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
});
