import { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./notifications/push";

export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"]
});

prisma.$use(async (params, next) => {
  const result = await next(params);

  if (params.model !== "Notification") {
    return result;
  }

  if (params.action === "create") {
    const data = params.args?.data;
    const userId = data?.userId;
    const payloadData = data?.data || {};
    if (userId) {
      await sendPushToUsers(prisma as any, [userId], {
        title: payloadData.title || "UZEED",
        body: payloadData.body || "Tienes una nueva notificación",
        data: { ...(payloadData || {}), url: payloadData.url || "/" },
        tag: data?.type || "uzeed-notification"
      });
    }
  }

  if (params.action === "createMany") {
    const records = params.args?.data;
    if (Array.isArray(records) && records.length > 0) {
      const first = records[0] || {};
      const userIds = records.map((item: any) => item?.userId).filter(Boolean);
      const payloadData = first?.data || {};
      if (userIds.length > 0) {
        await sendPushToUsers(prisma as any, userIds, {
          title: payloadData.title || "UZEED",
          body: payloadData.body || "Tienes una nueva notificación",
          data: { ...(payloadData || {}), url: payloadData.url || "/" },
          tag: first?.type || "uzeed-notification"
        });
      }
    }
  }

  return result;
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
});
