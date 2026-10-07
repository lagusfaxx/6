import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../db";
import { canMessage } from "../messages/canMessage";
import { sendToUser } from "../realtime/sse";
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

  // El aviso citado tiene que haber sido enviado a este mismo número.
  if (!relay || relay.waId !== from || !relay.peerId) {
    await sendCloudText(
      from,
      `No encontré a qué chat corresponde tu respuesta. Para contestar, desliza el mensaje del cliente y responde, o entra a ${CHAT_URL}`,
    );
    return;
  }

  if (message?.type !== "text" || typeof message?.text?.body !== "string") {
    await sendCloudText(from, `Por ahora solo puedo enviar mensajes de texto. Para fotos o audios entra a ${CHAT_URL}`);
    return;
  }

  const body = message.text.body.trim().slice(0, 5000);
  if (!body) return;

  // Aviso de prueba del admin (/admin/whatsapp → "Probar chat completo"):
  // se confirma la respuesta sin crear ningún mensaje real.
  if (relay.peerId === relay.userId) {
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
    await sendCloudText(from, `No se pudo enviar tu respuesta. Entra a ${CHAT_URL}`);
    return;
  }

  const created = await prisma.message.create({ data: { fromId: me, toId: other, body } });
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
