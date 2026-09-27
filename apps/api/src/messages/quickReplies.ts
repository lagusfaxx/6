import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  QUICK_REPLY_TOPICS,
  QUICK_REPLY_MAX_LENGTH,
  missingQuickReplies,
  normalizeQuickReplies,
  quickRepliesRequiredMessage,
} from "@uzeed/shared";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { isUUID } from "../lib/validators";
import { sendToUser } from "../realtime/sse";
import { canMessage } from "./canMessage";

export const quickRepliesRouter = Router();

const quickReplyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { error: "TOO_MANY_MESSAGES", message: "Demasiados mensajes. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Preguntas que el cliente puede tocar en el chat de una profesional: sólo las
 * que ella respondió. No incluye las respuestas: se entregan como mensajes al
 * tocarlas, así la profesional ve qué le preguntaron.
 */
export function quickReplyTopicsFor(raw: unknown) {
  const replies = normalizeQuickReplies(raw);
  return QUICK_REPLY_TOPICS.filter((t) => replies[t.key]).map((t) => ({
    key: t.key,
    label: t.label,
    question: t.question,
  }));
}

/** Respuestas rápidas de la profesional autenticada. */
quickRepliesRouter.get(
  "/messages/quick-replies",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { quickReplies: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const quickReplies = normalizeQuickReplies(user.quickReplies);
    return res.json({
      quickReplies,
      missing: missingQuickReplies(quickReplies),
      available: user.profileType === "PROFESSIONAL",
      maxLength: QUICK_REPLY_MAX_LENGTH,
    });
  }),
);

quickRepliesRouter.patch(
  "/messages/quick-replies",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profileType: true, quickReplies: true },
    });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (user.profileType !== "PROFESSIONAL") {
      return res.status(403).json({ error: "NOT_PROFESSIONAL" });
    }

    const raw = req.body?.quickReplies;
    if (raw && typeof raw === "object") {
      for (const value of Object.values(raw as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim().length > QUICK_REPLY_MAX_LENGTH) {
          return res.status(400).json({
            error: "MESSAGE_TOO_LONG",
            message: `Cada respuesta puede tener hasta ${QUICK_REPLY_MAX_LENGTH} caracteres.`,
          });
        }
      }
    }
    const quickReplies = normalizeQuickReplies(raw);
    const missing = missingQuickReplies(quickReplies);

    /* Se guarda aunque falte una obligatoria (quien completaba sólo la tarifa
       perdía lo escrito); queda pendiente y se responde qué falta. Lo que no
       se permite es borrar una obligatoria que ya estaba completa. */
    const before = missingQuickReplies(normalizeQuickReplies(user.quickReplies));
    const cleared = missing.filter((key) => !before.includes(key));
    if (cleared.length) {
      return res.status(400).json({
        error: "QUICK_REPLIES_REQUIRED",
        message: quickRepliesRequiredMessage(cleared),
        missing: cleared,
      });
    }

    await prisma.user.update({ where: { id: userId }, data: { quickReplies } });
    return res.json({ quickReplies, missing });
  }),
);

/**
 * El cliente toca una pregunta: queda su pregunta en el chat (y le llega el
 * aviso a la profesional, como cualquier mensaje) y unos segundos después,
 * con "escribiendo…" de por medio, la respuesta que ella dejó escrita.
 */
quickRepliesRouter.post(
  "/messages/:userId/quick-reply",
  requireAuth,
  quickReplyLimiter,
  asyncHandler(async (req, res) => {
    const me = req.session.userId!;
    const other = req.params.userId;
    if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });
    if (!isUUID(other) || other === me) return res.status(400).json({ error: "INVALID_TARGET_ID" });

    const topic = QUICK_REPLY_TOPICS.find((t) => t.key === String(req.body?.topic || ""));
    if (!topic) return res.status(400).json({ error: "INVALID_TOPIC" });

    const allowed = await canMessage(me, other);
    if (!allowed) return res.status(403).json({ error: "CHAT_NOT_ALLOWED" });

    const professional = await prisma.user.findUnique({
      where: { id: other },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        profileType: true,
        city: true,
        quickReplies: true,
      },
    });
    const answer = normalizeQuickReplies(professional?.quickReplies)[topic.key];
    if (!professional || professional.profileType !== "PROFESSIONAL" || !answer) {
      return res.status(404).json({ error: "QUICK_REPLY_NOT_FOUND" });
    }

    const question = await prisma.message.create({
      data: { fromId: me, toId: other, body: topic.question },
    });

    // La pregunta del cliente es un contacto real: la profesional recibe el
    // aviso igual que con un mensaje escrito a mano.
    await prisma.notification
      .create({
        data: {
          userId: other,
          type: "MESSAGE_RECEIVED",
          data: {
            title: "Nuevo mensaje",
            body: topic.question,
            fromId: me,
            messageId: question.id,
            url: `/chat/${me}`,
          },
        },
      })
      .catch((err) => {
        console.error("[quick-reply] Failed to create notification:", err?.message || err);
      });

    const sender = await prisma.user.findUnique({
      where: { id: me },
      select: { id: true, displayName: true, username: true, avatarUrl: true, profileType: true, city: true },
    });
    sendToUser(other, "message", { message: question, from: sender ?? undefined });

    // La respuesta no sale al instante: llegaba antes de que el cliente
    // terminara de ver su pregunta y se notaba automática. Se muestra
    // "escribiendo…" y llega después de una pausa acorde a su largo.
    const replyInMs = quickReplyDelayMs(answer);
    sendToUser(me, "typing", { fromId: other, ms: replyInMs });
    const timer = setTimeout(() => {
      deliverQuickReply(professional, me, answer, topic.key).catch((err) => {
        console.error("[quick-reply] delivery failed:", err?.message || err);
      });
    }, replyInMs);
    if (typeof timer.unref === "function") timer.unref();

    return res.json({ messages: [question], replyInMs });
  }),
);

/** Pausa antes de la respuesta: "leer" la pregunta y "escribir" el texto. */
function quickReplyDelayMs(answer: string): number {
  const typing = Math.min(answer.length * 35, 4500);
  return Math.round(1500 + typing + Math.random() * 800);
}

async function deliverQuickReply(
  professional: {
    id: string;
    displayName: string | null;
    username: string;
    avatarUrl: string | null;
    profileType: string;
    city: string | null;
  },
  clientId: string,
  answer: string,
  topic: string,
) {
  const reply = await prisma.message.create({
    data: { fromId: professional.id, toId: clientId, body: answer },
  });
  await prisma.quickReplyAnswer.create({
    data: { messageId: reply.id, professionalId: professional.id, clientId, topic },
  });
  sendToUser(clientId, "message", {
    message: reply,
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
