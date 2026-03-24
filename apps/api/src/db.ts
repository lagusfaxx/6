import { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./notifications/push";
import { sendToUser } from "./realtime/sse";

export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"]
});

// Track re-entrancy per-call using a counter instead of a boolean flag.
// A boolean flag is NOT safe for concurrent async operations — if two
// notification creates run concurrently, the second would skip the push
// because the first set the flag to true.
let _pushMiddlewareDepth = 0;

prisma.$use(async (params, next) => {
  const result = await next(params);

  if (params.model !== "Notification" || _pushMiddlewareDepth > 0) {
    return result;
  }

  _pushMiddlewareDepth++;
  try {
    if (params.action === "create") {
      const data = params.args?.data;
      const userId = data?.userId;
      const payloadData = (data?.data && typeof data.data === "object") ? data.data : {};
      if (userId) {
        // Send real-time SSE event so the bell badge updates instantly
        try {
          sendToUser(userId, "notification", {
            id: result?.id,
            type: data?.type,
            data: payloadData,
            readAt: null,
            createdAt: result?.createdAt || new Date().toISOString(),
          });
        } catch {}

        await sendPushToUsers(prisma as any, [userId], {
          title: payloadData.title || "UZEED",
          body: payloadData.body || "Tienes una nueva notificación",
          data: { ...payloadData, url: payloadData.url || "/" },
          tag: payloadData.tag || data?.type || "uzeed-notification"
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
              tag: payloadData.tag || item?.type || "uzeed-notification"
            }).catch((err) => {
              console.error("[push-middleware] sendPush failed for createMany item:", err?.message || err);
            });
          });
        await Promise.allSettled(pushPromises);
      }
    }
  } finally {
    _pushMiddlewareDepth--;
  }

  return result;
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
});
