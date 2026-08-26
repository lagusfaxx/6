import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { sendToUser } from "../realtime/sse";

export const AUTO_REPLY_DELAY_MS = 20_000;
export const AUTO_REPLY_MAX_LENGTH = 500;

// Una respuesta automática por conversación cada 24 horas: si el cliente
// insiste durante el día no recibe el mismo texto una y otra vez (sería la
// forma más obvia de notar que nadie está escribiendo del otro lado).
const AUTO_REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const autoReplyRouter = Router();

/**
 * Preferencia de respuesta automática de la profesional autenticada.
 */
autoReplyRouter.get(
  "/messages/auto-reply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { autoReplyEnabled: true, autoReplyMessage: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    return res.json({
      autoReplyEnabled: user.autoReplyEnabled,
      autoReplyMessage: user.autoReplyMessage || "",
      available: user.profileType === "PROFESSIONAL",
      maxLength: AUTO_REPLY_MAX_LENGTH,
      delaySeconds: AUTO_REPLY_DELAY_MS / 1000,
    });
  }),
);

autoReplyRouter.patch(
  "/messages/auto-reply",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const enabledRaw = req.body?.autoReplyEnabled;
    const messageRaw = req.body?.autoReplyMessage;

    const data: { autoReplyEnabled?: boolean; autoReplyMessage?: string | null } = {};

    if (messageRaw !== undefined) {
      const body = String(messageRaw ?? "").trim();
      if (body.length > AUTO_REPLY_MAX_LENGTH) {
        return res.status(400).json({
          error: "MESSAGE_TOO_LONG",
          message: `El mensaje automático no puede superar los ${AUTO_REPLY_MAX_LENGTH} caracteres.`,
        });
      }
      data.autoReplyMessage = body || null;
    }

    if (enabledRaw !== undefined) {
      if (typeof enabledRaw !== "boolean") {
        return res.status(400).json({ error: "INVALID_VALUE" });
      }
      // Activarlo sin texto dejaría la función encendida sin nada que enviar.
      if (enabledRaw) {
        const current =
          data.autoReplyMessage !== undefined
            ? data.autoReplyMessage
            : (
                await prisma.user.findUnique({
                  where: { id: userId },
                  select: { autoReplyMessage: true },
                })
              )?.autoReplyMessage || null;
        if (!current) {
          return res.status(400).json({
            error: "MESSAGE_REQUIRED",
            message: "Escribe el mensaje que quieres enviar antes de activarlo.",
          });
        }
      }
      data.autoReplyEnabled = enabledRaw;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { autoReplyEnabled: true, autoReplyMessage: true },
    });
    return res.json({
      autoReplyEnabled: user.autoReplyEnabled,
      autoReplyMessage: user.autoReplyMessage || "",
    });
  }),
);

/**
 * Envía la respuesta automática si sigue correspondiendo.
 *
 * Se vuelve a comprobar todo en el momento del envío (y no al programarlo)
 * porque en esos 20 segundos la profesional puede haber contestado ella misma
 * o haber apagado la función.
 */
async function deliverAutoReply(professionalId: string, clientId: string, since: Date) {
  const professional = await prisma.user.findUnique({
    where: { id: professionalId },
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      profileType: true,
      city: true,
      autoReplyEnabled: true,
      autoReplyMessage: true,
    },
  });
  const body = (professional?.autoReplyMessage || "").trim();
  if (!professional?.autoReplyEnabled || !body) return;

  // Si ya respondió ella, no hace falta el automático (y quedaría raro).
  const ownReply = await prisma.message.findFirst({
    where: { fromId: professionalId, toId: clientId, createdAt: { gte: since } },
    select: { id: true },
  });
  if (ownReply) return;

  const previous = await prisma.autoReplyLog.findUnique({
    where: { professionalId_clientId: { professionalId, clientId } },
    select: { sentAt: true },
  });
  if (previous && Date.now() - previous.sentAt.getTime() < AUTO_REPLY_COOLDOWN_MS) return;

  const message = await prisma.message.create({
    data: { fromId: professionalId, toId: clientId, body },
  });

  await prisma.autoReplyLog.upsert({
    where: { professionalId_clientId: { professionalId, clientId } },
    update: { sentAt: new Date() },
    create: { professionalId, clientId },
  });

  // El cliente recibe exactamente el mismo aviso que con un mensaje escrito a
  // mano: nada en la notificación ni en el chat delata que es automático.
  await prisma.notification
    .create({
      data: {
        userId: clientId,
        type: "MESSAGE_RECEIVED",
        data: {
          title: "Nuevo mensaje",
          body: body.slice(0, 100),
          fromId: professionalId,
          messageId: message.id,
          url: `/chat/${professionalId}`,
        },
      },
    })
    .catch((err) => {
      console.error("[auto-reply] Failed to create notification:", err?.message || err);
    });

  sendToUser(clientId, "message", {
    message,
    from: {
      id: professional.id,
      displayName: professional.displayName,
      username: professional.username,
      avatarUrl: professional.avatarUrl,
      profileType: professional.profileType,
      city: professional.city,
    },
  });
}

/**
 * Programa la respuesta automática 20 segundos después de que un cliente
 * escriba a una profesional.
 *
 * Importante: esto NO toca el mensaje del cliente. No lo marca como leído ni
 * actualiza el tiempo de respuesta de la profesional, así que su alerta de
 * mensaje nuevo sigue ahí esperándola.
 */
export function scheduleAutoReply(professionalId: string, clientId: string): void {
  if (professionalId === clientId) return;
  const since = new Date();
  const timer = setTimeout(() => {
    deliverAutoReply(professionalId, clientId, since).catch((err) => {
      console.error("[auto-reply] delivery failed:", err?.message || err);
    });
  }, AUTO_REPLY_DELAY_MS);
  // No debe mantener vivo el proceso si el servidor se está apagando.
  if (typeof timer.unref === "function") timer.unref();
}

/**
 * Normaliza lo que llega del registro para guardarlo en el User.
 * Sin texto no se activa nada: quedaría encendido sin mensaje que enviar.
 */
export function autoReplyFields(
  enabled?: boolean,
  message?: string | null,
): { autoReplyEnabled: boolean; autoReplyMessage: string | null } {
  const body = String(message ?? "").trim().slice(0, AUTO_REPLY_MAX_LENGTH);
  return {
    autoReplyEnabled: Boolean(enabled) && body.length > 0,
    autoReplyMessage: body || null,
  };
}
