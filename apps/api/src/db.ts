import { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./notifications/push";
import { maybeNotifyByWhatsApp } from "./notifications/whatsapp";
import { sendToUser } from "./realtime/sse";
import { invalidateUserCache } from "./auth/userCache";

const dbUrl = process.env.DATABASE_URL || "";
const poolParams = "connection_limit=30&pool_timeout=10";
const prismaUrl = dbUrl ? dbUrl + (dbUrl.includes("?") ? "&" : "?") + poolParams : "";

export const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"],
  ...(prismaUrl ? { datasources: { db: { url: prismaUrl } } } : {}),
});

// Track re-entrancy per-call using a counter instead of a boolean flag.
// A boolean flag is NOT safe for concurrent async operations — if two
// notification creates run concurrently, the second would skip the push
// because the first set the flag to true.
let _pushMiddlewareDepth = 0;

/**
 * Campos que cuentan como "editar la ficha" para `lastEditedAt`. Las
 * conexiones (`lastSeen`, `isOnline`) y lo que toca el sistema no cuentan.
 */
const PROFILE_EDIT_FIELDS = new Set([
  "displayName", "bio", "city", "address", "latitude", "longitude", "baseRate", "minDurationMinutes",
  "serviceDescription", "serviceCategory", "primaryCategory", "profileTags", "serviceTags", "serviceStyleTags",
  "availabilityNote", "avatarUrl", "coverUrl", "heightCm", "weightKg", "measurements", "hairColor", "skinTone",
  "languages", "acceptsIncalls", "acceptsOutcalls", "subscriptionPrice", "phone", "gender", "birthdate",
  "undisclosedFields", "autoReplyEnabled", "autoReplyMessage",
]);

prisma.$use(async (params, next) => {
  // Estadísticas: historial de tier y última edición de la ficha. Se resuelve
  // antes de la escritura para leer el tier anterior.
  let tierBefore: { id: string; tier: string | null }[] | null = null;
  if (params.model === "User" && (params.action === "update" || params.action === "updateMany")) {
    const data = params.args?.data;
    if (data && typeof data === "object") {
      if (Object.keys(data).some((k) => PROFILE_EDIT_FIELDS.has(k)) && data.lastEditedAt === undefined) {
        data.lastEditedAt = new Date();
      }
      if ("tier" in data && params.args?.where) {
        tierBefore = await prisma.user
          .findMany({ where: params.args.where, select: { id: true, tier: true }, take: 500 })
          .catch(() => null);
      }
    }
  }

  const result = await next(params);

  if (tierBefore) {
    const toTier = typeof params.args.data.tier === "string" ? params.args.data.tier : params.args.data.tier?.set ?? null;
    const changed = tierBefore.filter((u) => (u.tier ?? null) !== (toTier ?? null));
    if (changed.length) {
      prisma.profileTierHistory
        .createMany({ data: changed.map((u) => ({ userId: u.id, fromTier: u.tier ?? null, toTier: toTier ?? null })) })
        .catch((err) => console.error("[stats] tier history:", err?.message || err));
    }
  }
  // Subir una foto también es editar la ficha.
  if (params.model === "ProfileMedia" && params.action === "create" && params.args?.data?.ownerId) {
    prisma.user
      .update({ where: { id: params.args.data.ownerId }, data: { lastEditedAt: new Date() } })
      .catch(() => {});
  }

  // Invalidate user cache on any User update/delete
  if (params.model === "User" && (params.action === "update" || params.action === "delete")) {
    const userId = params.args?.where?.id;
    if (userId) invalidateUserCache(userId);
  }

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

        // Fire-and-forget — don't block the DB transaction waiting for push delivery
        sendPushToUsers(prisma as any, [userId], {
          title: payloadData.title || "UZEED",
          body: payloadData.body || "Tienes una nueva notificación",
          data: { ...payloadData, url: payloadData.url || "/" },
          tag: payloadData.tag || data?.type || "uzeed-notification"
        }).catch((err) => {
          console.error("[push-middleware] sendPush failed for create:", err?.message || err);
        });

        // WhatsApp para profesionales (PWA sin push instalado). El módulo
        // decide internamente si corresponde (tipo, cooldown, offline, phone).
        maybeNotifyByWhatsApp(prisma as any, userId, data?.type, payloadData).catch(() => {});
      }
    }

    if (params.action === "createMany") {
      const records = params.args?.data;
      if (Array.isArray(records) && records.length > 0) {
        const pushPromises = records
          .filter((item: any) => item?.userId)
          .map((item: any) => {
            const payloadData = (item?.data && typeof item.data === "object") ? item.data : {};
            maybeNotifyByWhatsApp(prisma as any, item.userId, item?.type, payloadData).catch(() => {});
            return sendPushToUsers(prisma as any, [item.userId], {
              title: payloadData.title || "UZEED",
              body: payloadData.body || "Tienes una nueva notificación",
              data: { ...payloadData, url: payloadData.url || "/" },
              tag: payloadData.tag || item?.type || "uzeed-notification"
            }).catch((err) => {
              console.error("[push-middleware] sendPush failed for createMany item:", err?.message || err);
            });
          });
        Promise.allSettled(pushPromises).catch(() => {});
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
