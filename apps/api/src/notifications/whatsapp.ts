import type { PrismaClient } from "@prisma/client";

/**
 * Bot de avisos por WhatsApp (WhatsApp Business Cloud API de Meta).
 *
 * Problema que resuelve: al ser una PWA, muchas profesionales no tienen
 * push activo y no se enteran cuando les escriben. Este módulo les envía
 * una plantilla de WhatsApp cuando reciben mensajes u otra actividad
 * importante en la app.
 *
 * Se activa solo si existen WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID.
 * Setup completo: docs/WHATSAPP_BOT.md
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "uzeed_notificacion";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "es";
const MESSAGE_COOLDOWN_MIN = Number(process.env.WHATSAPP_MESSAGE_COOLDOWN_MIN || 30);

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
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

/**
 * Envía la plantilla de notificación. La plantilla debe estar aprobada en
 * Meta Business y tener 2 variables de cuerpo: {{1}} nombre, {{2}} novedad.
 */
export async function sendWhatsAppTemplate(
  phone: string,
  params: [name: string, info: string],
): Promise<SendResult> {
  if (!isWhatsAppConfigured()) return { ok: false, error: "WHATSAPP_NOT_CONFIGURED" };
  const to = normalizePhoneForWhatsApp(phone);
  if (!to) return { ok: false, error: "INVALID_PHONE" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: TEMPLATE_LANG },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: sanitizeParam(params[0], 60) },
                  { type: "text", text: sanitizeParam(params[1]) },
                ],
              },
            ],
          },
        }),
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

/* ── Qué notificaciones se avisan por WhatsApp y con qué texto ── */

type NotifRule = {
  cooldownMin: number;
  /** Solo avisar si la usuaria NO está activa en la app ahora mismo. */
  onlyIfOffline: boolean;
  info: (payload: Record<string, any>) => string;
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
  SERVICE_PUBLISHED: {
    cooldownMin: 5,
    onlyIfOffline: false,
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

function markSent(key: string) {
  if (lastSentAt.size > 5000) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, v] of lastSentAt) {
      if (v < cutoff) lastSentAt.delete(k);
    }
  }
  lastSentAt.set(key, Date.now());
}

/**
 * Punto de entrada llamado desde el middleware de Notification.create.
 * Decide si corresponde avisar por WhatsApp y envía. Nunca lanza.
 */
export async function maybeNotifyByWhatsApp(
  prisma: PrismaClient,
  userId: string,
  type: string | undefined,
  payload: Record<string, any>,
): Promise<void> {
  try {
    if (!isWhatsAppConfigured() || !type) return;
    const rule = RULES[type];
    if (!rule) return;

    const key = `${userId}:${type}`;
    if (underCooldown(key, rule.cooldownMin)) return;

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
    if (rule.onlyIfOffline && isActiveInApp(user.isOnline, user.lastSeen)) return;

    const name = user.displayName || user.username || "";
    const result = await sendWhatsAppTemplate(user.phone, [name, rule.info(payload)]);
    if (result.ok) {
      markSent(key);
      console.log(`[whatsapp] notified user=${userId} type=${type} msg=${result.messageId}`);
    }
  } catch (err: any) {
    console.error("[whatsapp] maybeNotify error:", err?.message || err);
  }
}
