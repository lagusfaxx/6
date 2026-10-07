import type { PrismaClient } from "@prisma/client";
import { isBaileysEnabled, sendBaileysText } from "./whatsappBaileys";
import { isSmsConfigured, sendSms } from "./sms";

/**
 * Bot de avisos por WhatsApp con dos proveedores:
 *
 * - "baileys" (gratis): número normal de WhatsApp vía protocolo web, se
 *   activa con WHATSAPP_PROVIDER=baileys y vinculando el QR. Envía texto
 *   libre sin plantillas. Ver whatsappBaileys.ts.
 * - "cloud" (oficial Meta): se activa con WHATSAPP_TOKEN +
 *   WHATSAPP_PHONE_NUMBER_ID. Envía plantillas aprobadas.
 *
 * Problema que resuelve: al ser una PWA, muchas profesionales no tienen
 * push activo y no se enteran cuando les escriben.
 * Setup completo: docs/WHATSAPP_BOT.md
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "uzeed_notificacion";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "es";
/* Plantilla de mensajes de clientes: {{1}} profesional, {{2}} cliente, {{3}} texto. */
const MESSAGE_TEMPLATE_NAME = process.env.WHATSAPP_MESSAGE_TEMPLATE_NAME || "uzeed_mensaje";
/* Meta da 24 h; se deja margen para que el texto libre no llegue tarde. */
const SERVICE_WINDOW_MS = 23 * 60 * 60 * 1000;
const MESSAGE_COOLDOWN_MIN = Number(process.env.WHATSAPP_MESSAGE_COOLDOWN_MIN || 30);
const CHAT_URL = process.env.WHATSAPP_NOTIFY_URL || "https://uzeed.cl/chats";

export type WhatsAppProvider = "baileys" | "cloud" | null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (isBaileysEnabled()) return "baileys";
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return "cloud";
  return null;
}

export function isWhatsAppConfigured(): boolean {
  return getWhatsAppProvider() !== null;
}

/**
 * Normaliza un teléfono al formato wa (solo dígitos con código país).
 * Acepta formatos chilenos habituales: "+56 9 1234 5678", "912345678",
 * "09 1234 5678", "56912345678".
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // "09xxxxxxxx" → quita el 0 de marcado nacional
  if (digits.length === 10 && digits.startsWith("09")) digits = digits.slice(1);
  // Móvil chileno sin código país: 9xxxxxxxx (9 dígitos)
  if (digits.length === 9 && digits.startsWith("9")) digits = `56${digits}`;
  // 8 dígitos: móvil viejo sin el 9 — no confiable, descartar
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

type SendResult = { ok: boolean; status?: number; error?: string; messageId?: string };

/** Texto seguro para parámetros de plantilla (sin saltos de línea, acotado). */
function sanitizeParam(text: string, max = 200): string {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max) || "-";
}

/** POST a la Cloud API de Meta con el número del bot. */
async function cloudSend(payload: Record<string, any>): Promise<SendResult> {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, error: "CLOUD_API_NOT_CONFIGURED" };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      },
    );
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = json?.error?.message || `HTTP_${res.status}`;
      console.error(`[whatsapp] send failed (${res.status}):`, error);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, messageId: json?.messages?.[0]?.id };
  } catch (err: any) {
    console.error("[whatsapp] send error:", err?.message || err);
    return { ok: false, error: err?.message || "NETWORK_ERROR" };
  }
}

/** Plantilla aprobada en Meta con variables de cuerpo {{1}}, {{2}}, ... */
async function sendCloudTemplate(to: string, template: string, params: string[]): Promise<SendResult> {
  return cloudSend({
    to,
    type: "template",
    template: {
      name: template,
      language: { code: TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}

/** Texto libre: Meta solo lo entrega dentro de las 24 h desde que el número escribió. */
export async function sendCloudText(to: string, text: string): Promise<SendResult> {
  return cloudSend({ to, type: "text", text: { body: text, preview_url: false } });
}

/** Reacción a un mensaje recibido (confirma que la respuesta se envió). */
export async function sendCloudReaction(to: string, messageId: string, emoji: string): Promise<SendResult> {
  return cloudSend({ to, type: "reaction", reaction: { message_id: messageId, emoji } });
}

/**
 * Envía la plantilla de notificación. La plantilla debe estar aprobada en
 * Meta Business y tener 2 variables de cuerpo: {{1}} nombre, {{2}} novedad.
 */
export async function sendWhatsAppTemplate(
  phone: string,
  params: [name: string, info: string],
): Promise<SendResult> {
  const to = normalizePhoneForWhatsApp(phone);
  if (!to) return { ok: false, error: "INVALID_PHONE" };
  return sendCloudTemplate(to, TEMPLATE_NAME, [sanitizeParam(params[0], 60), sanitizeParam(params[1])]);
}

/**
 * Envío unificado: usa el proveedor activo. Con Baileys va como texto
 * libre; con la Cloud API va como plantilla aprobada.
 */
export async function sendWhatsAppNotification(
  phone: string,
  name: string,
  info: string,
): Promise<SendResult> {
  const provider = getWhatsAppProvider();
  if (!provider) return { ok: false, error: "WHATSAPP_NOT_CONFIGURED" };

  if (provider === "baileys") {
    const to = normalizePhoneForWhatsApp(phone);
    if (!to) return { ok: false, error: "INVALID_PHONE" };
    const text = `Hola ${sanitizeParam(name, 60)} 👋 Tienes novedades en UZEED: ${sanitizeParam(info)}.\n\nEntra ahora para responder y no perder al cliente:\n${CHAT_URL}`;
    return sendBaileysText(to, text);
  }

  return sendWhatsAppTemplate(phone, [name, info]);
}

/* ── Qué notificaciones se avisan por WhatsApp y con qué texto ── */

type NotifRule = {
  cooldownMin: number;
  /** Si está activa en la app, no avisar ahora y volver a revisar en unos minutos. */
  onlyIfOffline: boolean;
  info: (payload: Record<string, any>) => string;
  /** Tipos que avisan del mismo evento comparten cooldown (un solo aviso). */
  group?: string;
};

const RULES: Record<string, NotifRule> = {
  MESSAGE_RECEIVED: {
    cooldownMin: MESSAGE_COOLDOWN_MIN,
    onlyIfOffline: true,
    info: () => "tienes mensajes nuevos de clientes esperándote",
  },
  SERVICE_REQUEST_NEW: {
    cooldownMin: 5,
    onlyIfOffline: false,
    // Cada solicitud crea SERVICE_PUBLISHED y SERVICE_REQUEST_NEW a la vez.
    group: "SERVICE_REQUEST",
    info: () => "tienes una nueva solicitud de encuentro",
  },
  VIDEOCALL_BOOKED: {
    cooldownMin: 0,
    onlyIfOffline: false,
    info: () => "te agendaron una videollamada",
  },
  BOOKING_UPDATE: {
    cooldownMin: 5,
    onlyIfOffline: false,
    info: (p) => (typeof p?.title === "string" && p.title ? p.title : "tienes una actualización de reserva"),
  },
  MARKET_NEW_ORDER: {
    cooldownMin: 0,
    onlyIfOffline: false,
    info: () => "vendiste un artículo en el marketplace",
  },
  SERVICE_PUBLISHED: {
    cooldownMin: 5,
    onlyIfOffline: false,
    group: "SERVICE_REQUEST",
    info: () => "tienes una nueva solicitud de servicio",
  },
};

const NOTIFIABLE_PROFILE_TYPES = new Set(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"]);

/** Considera "activa en la app" si está online y se la vio hace < 2 minutos. */
function isActiveInApp(isOnline: boolean, lastSeen: Date | null): boolean {
  if (!isOnline) return false;
  if (!lastSeen) return true;
  return Date.now() - lastSeen.getTime() < 2 * 60 * 1000;
}

/* Cooldown en memoria por usuario+tipo. Si el proceso se reinicia, el peor
   caso es un aviso repetido — aceptable para este volumen. */
const lastSentAt = new Map<string, number>();

function underCooldown(key: string, cooldownMin: number): boolean {
  if (cooldownMin <= 0) return false;
  const last = lastSentAt.get(key);
  return Boolean(last && Date.now() - last < cooldownMin * 60 * 1000);
}

/**
 * Reserva el cupo del cooldown antes de enviar. Se marca de inmediato (sin
 * await de por medio) para que varios mensajes seguidos del cliente, que
 * llegan casi al mismo tiempo, no generen un aviso cada uno.
 */
function tryReserve(key: string, cooldownMin: number): boolean {
  if (cooldownMin <= 0) return true;
  if (underCooldown(key, cooldownMin)) return false;
  markSent(key);
  return true;
}

function markSent(key: string) {
  if (lastSentAt.size > 5000) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, v] of lastSentAt) {
      if (v < cutoff) lastSentAt.delete(k);
    }
  }
  lastSentAt.set(key, Date.now());
}

/** Texto del mensaje del cliente para reenviarlo (las fotos van como aviso). */
async function relayedMessageText(prisma: PrismaClient, payload: Record<string, any>): Promise<string> {
  const id = typeof payload?.messageId === "string" ? payload.messageId : null;
  const message = id
    ? await prisma.message.findUnique({ where: { id }, select: { body: true } }).catch(() => null)
    : null;
  const body = message?.body ?? String(payload?.body || "");
  if (body.startsWith("ATTACHMENT_IMAGE:")) return "📷 Te envió una foto";
  return body.trim().slice(0, 1000) || "-";
}

/** Guarda a qué chat pertenece un aviso enviado, para enrutar la respuesta. */
async function saveRelay(
  prisma: PrismaClient,
  wamid: string | undefined,
  userId: string,
  peerId: string | null,
  waId: string,
): Promise<void> {
  if (!wamid) return;
  await prisma.whatsAppRelay
    .create({ data: { wamid, userId, peerId, waId } })
    .catch((err: any) => console.error("[whatsapp] relay save failed:", err?.message || err));
  // Limpieza ocasional: una respuesta a un aviso de hace más de 30 días ya no se enruta.
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.whatsAppRelay.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
  }
}

/** Texto del SMS: corto y neutro, sin el contenido del chat. */
export function smsNotificationText(info: string): string {
  return `UZEED: ${sanitizeParam(info, 100)}. Revisa tu cuenta en ${CHAT_URL.replace(/^https?:\/\//, "")}`;
}

/** Deja registro del envío para las estadísticas del panel. Nunca lanza. */
export async function logDelivery(
  prisma: PrismaClient,
  entry: { userId?: string | null; channel: "SMS" | "WHATSAPP"; type: string; result: SendResult },
): Promise<void> {
  await prisma.notificationDelivery
    .create({
      data: {
        userId: entry.userId ?? null,
        channel: entry.channel,
        type: entry.type,
        ok: entry.result.ok,
        error: entry.result.ok ? null : String(entry.result.error || "ERROR").slice(0, 300),
        providerId: entry.result.messageId ?? null,
      },
    })
    .catch((err: any) => console.error("[notify] delivery log failed:", err?.message || err));
}

/**
 * Prueba de punta a punta para el admin: le llega a su WhatsApp el mismo aviso
 * que recibe una profesional cuando un cliente le escribe. El aviso queda
 * guardado con peerId = userId, y el webhook reconoce eso como prueba: al
 * responderlo no se crea ningún mensaje real, solo confirma que llegó.
 */
export async function sendTestChat(prisma: PrismaClient, adminId: string, phone: string): Promise<SendResult> {
  if (getWhatsAppProvider() !== "cloud") return { ok: false, error: "SOLO_CLOUD_API" };
  const to = normalizePhoneForWhatsApp(phone);
  if (!to) return { ok: false, error: "INVALID_PHONE" };
  const contact = await prisma.whatsAppContact.findUnique({ where: { waId: to } });
  const windowOpen = Boolean(contact && Date.now() - contact.lastInboundAt.getTime() < SERVICE_WINDOW_MS);
  const text = "Hola, ¿tienes disponibilidad hoy? (mensaje de prueba)";
  const result = windowOpen
    ? await sendCloudText(to, `💬 *Cliente de prueba*: ${text}\n\n↩️ Responde aquí para contestarle.`)
    : await sendCloudTemplate(to, MESSAGE_TEMPLATE_NAME, ["Admin", "Cliente de prueba", text]);
  await logDelivery(prisma, { userId: adminId, channel: "WHATSAPP", type: "TEST_CHAT", result });
  if (result.ok) await saveRelay(prisma, result.messageId, adminId, adminId, to);
  return result;
}

/** Respaldo por SMS cuando WhatsApp no está disponible o falla. */
async function notifyBySms(
  prisma: PrismaClient,
  userId: string,
  type: string,
  to: string,
  info: string,
): Promise<boolean> {
  const result = await sendSms(to, smsNotificationText(info));
  await logDelivery(prisma, { userId, channel: "SMS", type, result });
  if (result.ok) console.log(`[sms] notified user=${userId} type=${type} msg=${result.messageId}`);
  return result.ok;
}

/* Si estaba conectada cuando llegó el mensaje, se vuelve a revisar unos
   minutos después: puede haber cerrado la app justo antes, o tenerla abierta
   sin mirar el chat. Una revisión pendiente por profesional y tipo; los
   timers viven en memoria (tras un reinicio, el peor caso es no reintentar). */
const RECHECK_DELAY_MS = 3 * 60 * 1000;
const MAX_RECHECKS = 2;
const pendingRechecks = new Set<string>();

function scheduleRecheck(
  prisma: PrismaClient,
  userId: string,
  type: string,
  payload: Record<string, any>,
  recheck: number,
): void {
  if (recheck >= MAX_RECHECKS) return;
  const key = `${userId}:${type}`;
  if (pendingRechecks.has(key)) return;
  pendingRechecks.add(key);
  setTimeout(() => {
    pendingRechecks.delete(key);
    maybeNotifyByWhatsApp(prisma, userId, type, payload, recheck + 1).catch(() => {});
  }, RECHECK_DELAY_MS).unref?.();
}

async function isMessageRead(prisma: PrismaClient, payload: Record<string, any>): Promise<boolean> {
  const id = typeof payload?.messageId === "string" ? payload.messageId : null;
  if (!id) return false;
  const message = await prisma.message.findUnique({ where: { id }, select: { readAt: true } }).catch(() => null);
  return Boolean(message?.readAt);
}

/**
 * Punto de entrada llamado desde el middleware de Notification.create.
 * Decide si corresponde avisar por WhatsApp (o por SMS de respaldo, ver
 * sms.ts) y envía. Nunca lanza.
 *
 * Con la Cloud API, los mensajes de clientes se reenvían con su texto y la
 * profesional puede responder desde WhatsApp (ver whatsappWebhook.ts). Si
 * escribió al bot en las últimas 24 h se reenvían todos como texto libre;
 * si no, va una plantilla con el cooldown de siempre.
 */
export async function maybeNotifyByWhatsApp(
  prisma: PrismaClient,
  userId: string,
  type: string | undefined,
  payload: Record<string, any>,
  recheck = 0,
): Promise<void> {
  const smsOn = isSmsConfigured();
  // SMS_MODE=primary: los avisos van solo por SMS aunque haya WhatsApp.
  const provider = smsOn && process.env.SMS_MODE === "primary" ? null : getWhatsAppProvider();
  if ((!provider && !smsOn) || !type) return;
  const rule = RULES[type];
  if (!rule) return;

  const peerId = typeof payload?.fromId === "string" ? payload.fromId : null;
  const relay = provider === "cloud" && type === "MESSAGE_RECEIVED" && Boolean(peerId);

  const key = `${userId}:${rule.group ?? type}`;
  // El reenvío por WhatsApp con la ventana de 24 h abierta no tiene cooldown,
  // pero eso recién se sabe después de consultar la base.
  const reserved = tryReserve(key, rule.cooldownMin);
  if (!reserved && !relay) return;
  let delivered = false;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        profileType: true,
        isOnline: true,
        lastSeen: true,
        displayName: true,
        username: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) return;
    if (!NOTIFIABLE_PROFILE_TYPES.has(String(user.profileType))) return;
    if (!user.phone) return;
    if (rule.onlyIfOffline) {
      // En una nueva revisión: si ya leyó el mensaje en la app, no hace falta avisar.
      if (recheck > 0 && (await isMessageRead(prisma, payload))) return;
      if (isActiveInApp(user.isOnline, user.lastSeen)) {
        scheduleRecheck(prisma, userId, type, payload, recheck);
        return;
      }
    }
    const to = normalizePhoneForWhatsApp(user.phone);
    if (!to) return;

    const name = user.displayName || user.username || "";
    const info = rule.info(payload);

    if (relay) {
      const contact = await prisma.whatsAppContact.findUnique({ where: { waId: to } });
      const windowOpen = Boolean(contact && Date.now() - contact.lastInboundAt.getTime() < SERVICE_WINDOW_MS);
      if (!windowOpen && !reserved) return;

      const sender = await prisma.user.findUnique({
        where: { id: peerId! },
        select: { displayName: true, username: true },
      });
      const senderName = sanitizeParam(sender?.displayName || sender?.username || "Un cliente", 60);
      const text = await relayedMessageText(prisma, payload);

      const result = windowOpen
        ? await sendCloudText(to, `💬 *${senderName}*: ${text}\n\n↩️ Responde aquí para contestarle.`)
        : await sendCloudTemplate(to, MESSAGE_TEMPLATE_NAME, [
            sanitizeParam(name, 60),
            senderName,
            sanitizeParam(text, 300),
          ]);
      await logDelivery(prisma, { userId, channel: "WHATSAPP", type, result });
      if (result.ok) {
        delivered = true;
        await saveRelay(prisma, result.messageId, userId, peerId, to);
        console.log(`[whatsapp] relayed user=${userId} from=${peerId} msg=${result.messageId}`);
      } else if (smsOn && reserved) {
        delivered = await notifyBySms(prisma, userId, type, to, info);
      }
      return;
    }

    if (!provider) {
      delivered = await notifyBySms(prisma, userId, type, to, info);
      return;
    }

    const result = await sendWhatsAppNotification(user.phone, name, info);
    await logDelivery(prisma, { userId, channel: "WHATSAPP", type, result });
    if (result.ok) {
      delivered = true;
      // Responder a un aviso que no es de un chat no debe caer en el último chat.
      if (provider === "cloud") await saveRelay(prisma, result.messageId, userId, null, to);
      console.log(`[whatsapp] notified user=${userId} type=${type} msg=${result.messageId}`);
    } else if (smsOn) {
      delivered = await notifyBySms(prisma, userId, type, to, info);
    }
  } catch (err: any) {
    console.error("[whatsapp] maybeNotify error:", err?.message || err);
  } finally {
    // Si no salió ningún aviso, el cupo queda libre para el próximo evento
    // (ej. estaba conectada y luego se desconecta).
    if (reserved && !delivered) lastSentAt.delete(key);
  }
}
