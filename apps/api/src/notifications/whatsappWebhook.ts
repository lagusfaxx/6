import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../db";
import { canMessage } from "../messages/canMessage";
import { sendToUser } from "../realtime/sse";
import { emitAdminEvent } from "../lib/adminEvents";
import { getWhatsAppProvider, sendCloudReaction, sendCloudText } from "./whatsapp";

/**
 * Webhook de la Cloud API de Meta: la profesional responde desde WhatsApp y
 * su respuesta se envía como mensaje en el chat de UZEED.
 *
 * A qué chat va: si responde deslizando un aviso, al chat de ese aviso; si
 * escribe sin citar, al chat del último aviso que recibió. Los avisos que no
 * son de un chat (videollamadas, reservas...) no enrutan respuestas.
 *
 * Configuración en Meta: Callback URL https://<api>/webhooks/whatsapp, el
 * Verify token de WHATSAPP_WEBHOOK_VERIFY_TOKEN y el campo "messages".
 * WHATSAPP_APP_SECRET valida la firma de cada entrega.
 * Setup completo: docs/WHATSAPP_BOT.md
 */

export const whatsappWebhookRouter = Router();

const CHAT_URL = process.env.WHATSAPP_NOTIFY_URL || "https://uzeed.cl/chats";
/* Sin citar un aviso, la respuesta va al último chat solo si es reciente. */
const LAST_RELAY_MAX_AGE_MS = 48 * 60 * 60 * 1000;
/*
 * Lo que llega segundos después de un aviso, sin citarlo, es la respuesta
 * automática de WhatsApp Business ("Hola amor, disponible…", "atiendo de
 * lunes a viernes…"): se registra y no se le contesta. Un 6/11 el aviso de
 * plan sacó varias en menos de 20 s y el bot les respondía "No encontré a qué
 * chat corresponde tu respuesta".
 */
const AUTO_REPLY_MAX_MS = 60 * 1000;
/* Un aviso del equipo (difusión, plan…) se puede contestar hasta 7 días después. */
const TEAM_REPLY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/* El bot explica qué pasó con la respuesta una vez cada 12 h por número. */
const BOT_EXPLAIN_EVERY_MS = 12 * 60 * 60 * 1000;

whatsappWebhookRouter.get("/webhooks/whatsapp", (req, res) => {
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    expected &&
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === expected
  ) {
    return res.status(200).send(String(req.query["hub.challenge"] ?? ""));
  }
  return res.sendStatus(403);
});

function validSignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

whatsappWebhookRouter.post("/webhooks/whatsapp", (req, res) => {
  if (!validSignature((req as any).rawBody, req.get("x-hub-signature-256"))) {
    return res.sendStatus(401);
  }
  // Meta reintenta si no recibe 200 rápido: se responde primero y se procesa después.
  res.sendStatus(200);

  for (const entry of req.body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const message of change?.value?.messages ?? []) {
        handleIncoming(message).catch((err) =>
          console.error("[whatsapp:webhook] error:", err?.message || err),
        );
      }
    }
  }
});

/* Meta puede entregar el mismo mensaje más de una vez. */
const seen = new Map<string, number>();

function alreadySeen(id: string): boolean {
  const now = Date.now();
  if (seen.has(id)) return true;
  if (seen.size > 2000) {
    for (const [k, t] of seen) if (now - t > 60 * 60 * 1000) seen.delete(k);
  }
  seen.set(id, now);
  return false;
}

const PROSPECT_URL = process.env.WHATSAPP_PROSPECT_URL || "https://uzeed.cl/publicate";
const OPT_OUT_RE = /^\s*(stop|baja|detener|cancelar|no\s+(quiero|gracias|me\s+interesa))\b/i;
/* Un aviso al equipo por contacto cada 12 h, aunque escriba varias veces. */
const PROSPECT_NOTIFY_EVERY_MS = 12 * 60 * 60 * 1000;

/**
 * Respuesta de un contacto sin cuenta (WhatsAppProspect). STOP/BAJA lo saca de
 * los envíos; cualquier otra cosa recibe el link para publicarse y avisa al
 * equipo. Devuelve false si el número no es un contacto de estos.
 */
async function handleProspectReply(from: string, message: any): Promise<boolean> {
  const prospect = await prisma.whatsAppProspect.findUnique({ where: { waId: from } });
  if (!prospect) return false;
  const text = typeof message?.text?.body === "string" ? message.text.body : "";
  const quickReply = typeof message?.button?.text === "string" ? message.button.text : "";

  if (OPT_OUT_RE.test(text) || OPT_OUT_RE.test(quickReply)) {
    await prisma.whatsAppProspect.update({ where: { waId: from }, data: { optedOutAt: new Date() } });
    await sendCloudText(from, "Listo, no te enviaremos más mensajes. ¡Gracias!");
    return true;
  }

  const notify = !prospect.repliedAt || Date.now() - prospect.repliedAt.getTime() > PROSPECT_NOTIFY_EVERY_MS;
  await prisma.whatsAppProspect.update({ where: { waId: from }, data: { repliedAt: new Date() } });
  if (notify) {
    await sendCloudText(
      from,
      `¡Hola${prospect.name ? ` ${prospect.name}` : ""}! Gracias por responder 🙌 Puedes crear tu perfil en UZEED aquí: ${PROSPECT_URL}\n\nAlguien del equipo te va a escribir para ayudarte. Si no quieres recibir más mensajes, responde BAJA.`,
    );
    await emitAdminEvent({
      type: "whatsapp_prospect_replied",
      user: `${prospect.name || "Sin nombre"} (+${from}): ${(text || quickReply || `[${message?.type || "mensaje"}]`).slice(0, 200)}`,
    }).catch(() => {});
  }
  return true;
}

/**
 * SENT: llegó al chat del cliente. TEAM: respondió a un aviso del equipo
 * (difusión, plan, prueba gratis…), no a un cliente. AUTO: respuesta
 * automática de WhatsApp Business. NO_CHAT: no se sabe a qué responde.
 */
export type ReplyStatus = "SENT" | "TEAM" | "AUTO" | "NO_CHAT" | "NOT_TEXT" | "BLOCKED" | "TEST";

/** ¿Ya se le explicó algo a este número en las últimas 12 h? */
async function explainedRecently(waId: string): Promise<boolean> {
  const last = await prisma.whatsAppReply.findFirst({
    where: { waId, status: { in: ["TEAM", "NO_CHAT"] }, createdAt: { gt: new Date(Date.now() - BOT_EXPLAIN_EVERY_MS) } },
    select: { id: true },
  });
  return Boolean(last);
}

/* Registro para /admin/whatsapp: qué llegó, de quién y en qué terminó. Un
   fallo al guardarlo no puede frenar la respuesta. */
async function logReply(data: {
  waId: string;
  userId?: string | null;
  peerId?: string | null;
  messageId?: string | null;
  kind: string;
  body?: string | null;
  status: ReplyStatus;
  inReplyTo?: string | null;
}) {
  await prisma.whatsAppReply
    .create({ data: { ...data, body: data.body?.slice(0, 2000) ?? null } })
    .catch((err) => console.error("[whatsapp:webhook] reply log failed:", err?.message || err));
}

async function handleIncoming(message: any): Promise<void> {
  const from = String(message?.from || "");
  const wamid = String(message?.id || "");
  if (!from || !wamid || alreadySeen(wamid)) return;
  if (getWhatsAppProvider() !== "cloud") return;

  // Abre la ventana de 24 h en que se le puede escribir sin plantilla.
  await prisma.whatsAppContact.upsert({
    where: { waId: from },
    create: { waId: from, lastInboundAt: new Date() },
    update: { lastInboundAt: new Date() },
  });

  const contextId = typeof message?.context?.id === "string" ? message.context.id : null;
  const relay = contextId
    ? await prisma.whatsAppRelay.findUnique({ where: { wamid: contextId } })
    : await prisma.whatsAppRelay.findFirst({
        where: { waId: from, createdAt: { gt: new Date(Date.now() - LAST_RELAY_MAX_AGE_MS) } },
        orderBy: { createdAt: "desc" },
      });

  const kind = String(message?.type || "unknown");
  const textBody = typeof message?.text?.body === "string" ? message.text.body.trim() : null;

  // Contacto sin cuenta que responde a una plantilla enviada desde el MCP.
  if (!relay && (await handleProspectReply(from, message))) return;

  // El aviso citado tiene que haber sido enviado a este mismo número.
  if (!relay || relay.waId !== from || !relay.peerId) {
    await handleNotChat(from, kind, textBody, relay && relay.waId === from ? relay : null, Boolean(contextId));
    return;
  }

  if (message?.type !== "text" || typeof message?.text?.body !== "string") {
    await logReply({ waId: from, userId: relay.userId, peerId: relay.peerId, kind, status: "NOT_TEXT" });
    await sendCloudText(from, `Por ahora solo puedo enviar mensajes de texto. Para fotos o audios entra a ${CHAT_URL}`);
    return;
  }

  const body = message.text.body.trim().slice(0, 5000);
  if (!body) return;

  // Aviso de prueba del admin (/admin/whatsapp → "Probar chat completo"):
  // se confirma la respuesta sin crear ningún mensaje real.
  if (relay.peerId === relay.userId) {
    await logReply({ waId: from, userId: relay.userId, kind, body, status: "TEST" });
    await sendCloudText(
      from,
      `✅ Prueba correcta: recibimos tu respuesta "${body.slice(0, 200)}". En un chat real le habría llegado al cliente en UZEED.`,
    );
    await sendCloudReaction(from, wamid, "✅");
    return;
  }

  const me = relay.userId;
  const other = relay.peerId;
  const user = await prisma.user.findUnique({
    where: { id: me },
    select: { id: true, isActive: true, displayName: true, username: true, avatarUrl: true, profileType: true, city: true },
  });
  if (!user?.isActive || !(await canMessage(me, other))) {
    await logReply({ waId: from, userId: me, peerId: other, kind, body, status: "BLOCKED" });
    await sendCloudText(from, `No se pudo enviar tu respuesta. Entra a ${CHAT_URL}`);
    return;
  }

  const created = await prisma.message.create({ data: { fromId: me, toId: other, body } });
  await logReply({ waId: from, userId: me, peerId: other, messageId: created.id, kind, body, status: "SENT" });
  // Respondió: lo que el cliente le había escrito queda leído.
  await prisma.message.updateMany({
    where: { fromId: other, toId: me, readAt: null, createdAt: { lte: created.createdAt } },
    data: { readAt: new Date() },
  });
  await prisma.notification
    .create({
      data: {
        userId: other,
        type: "MESSAGE_RECEIVED",
        data: { title: "Nuevo mensaje", body: body.slice(0, 100), fromId: me, messageId: created.id, url: `/chat/${me}` },
      },
    })
    .catch((err) => console.error("[whatsapp:webhook] notification failed:", err?.message || err));

  const { isActive: _isActive, ...sender } = user;
  sendToUser(other, "message", { message: created, from: sender });

  await sendCloudReaction(from, wamid, "✅");
  console.log(`[whatsapp:webhook] reply user=${me} to=${other} msg=${created.id}`);
}

type RelayRow = { userId: string; peerId: string | null; kind: string | null; createdAt: Date };

/**
 * Respuesta que no va a ningún chat con un cliente. Casi siempre contesta un
 * aviso del propio UZEED (difusión desde el MCP, aviso de plan, prueba
 * gratis) o es la respuesta automática de su WhatsApp Business. Nada de eso
 * se le reenvía a un cliente.
 */
async function handleNotChat(
  from: string,
  kind: string,
  textBody: string | null,
  quoted: RelayRow | null,
  isQuote: boolean,
): Promise<void> {
  // Último aviso que el bot le mandó a este número (cualquiera).
  const last: RelayRow | null =
    quoted ??
    (await prisma.whatsAppRelay.findFirst({
      where: { waId: from },
      orderBy: { createdAt: "desc" },
      select: { userId: true, peerId: true, kind: true, createdAt: true },
    }));
  const userId = last?.userId ?? null;
  const inReplyTo = last?.kind ?? null;
  const age = last ? Date.now() - last.createdAt.getTime() : Infinity;

  if (!isQuote && last && age < AUTO_REPLY_MAX_MS) {
    await logReply({ waId: from, userId, kind, body: textBody, status: "AUTO", inReplyTo });
    return;
  }

  const toTeam = Boolean(last && !last.peerId && age < TEAM_REPLY_MAX_AGE_MS);
  const status: ReplyStatus = toTeam ? "TEAM" : "NO_CHAT";
  // Antes de registrar esta: si ya se le explicó hace poco, no se repite.
  const explained = await explainedRecently(from);
  await logReply({ waId: from, userId, kind, body: textBody, status, inReplyTo });

  // Al equipo le llega un aviso por número cada 12 h; el resto queda en el panel.
  if (toTeam && kind !== "reaction" && !explained) {
    const who = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, username: true } })
      : null;
    await emitAdminEvent({
      type: "whatsapp_team_reply",
      user: `${who?.displayName || who?.username || "Profesional"}: ${(textBody || `[${kind}]`).slice(0, 200)}`,
    }).catch(() => {});
  }

  // Una reacción (👍) no necesita respuesta, y tampoco se repite la explicación.
  if (kind === "reaction" || explained) return;
  await sendCloudText(
    from,
    toTeam
      ? `¡Gracias por responder! Tu mensaje le llegó al equipo de UZEED. Si querías contestarle a un cliente, desliza su mensaje y responde, o entra a ${CHAT_URL}`
      : `No encontré a qué chat corresponde tu respuesta. Para contestar, desliza el mensaje del cliente y responde, o entra a ${CHAT_URL}`,
  );
}
