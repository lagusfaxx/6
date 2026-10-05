import { prisma } from "../db";
import { isBaileysEnabled, sendBaileysText } from "../notifications/whatsappBaileys";
import { getWhatsAppProvider, logDelivery, normalizePhoneForWhatsApp } from "../notifications/whatsapp";
import { isSmsConfigured, sendSms } from "../notifications/sms";

/**
 * Envío del código de verificación por WhatsApp o SMS (respaldo del email).
 *
 * - WhatsApp con Baileys: texto libre.
 * - WhatsApp con la Cloud API de Meta: requiere una plantilla de categoría
 *   "Autenticación" aprobada, cuyo nombre va en WHATSAPP_OTP_TEMPLATE_NAME.
 *   Sin ella, la Cloud API no puede mandar el código y se usa SMS.
 * - SMS: LabsMobile (LABSMOBILE_USER + LABSMOBILE_TOKEN).
 */

export type PhoneChannel = "whatsapp" | "sms";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const OTP_TEMPLATE = process.env.WHATSAPP_OTP_TEMPLATE_NAME || "";
const OTP_TEMPLATE_LANG = process.env.WHATSAPP_OTP_TEMPLATE_LANG || process.env.WHATSAPP_TEMPLATE_LANG || "es";

/* Tope diario de códigos por teléfono: el SMS cuesta y evita abuso (SMS pumping). */
const MAX_SENDS_PER_PHONE_PER_DAY = Number(process.env.PHONE_CODE_MAX_PER_DAY || 5);
const DAY_MS = 24 * 60 * 60 * 1000;
const sendsByPhone = new Map<string, { count: number; windowStart: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sendsByPhone) if (now - v.windowStart > DAY_MS) sendsByPhone.delete(k);
}, 60 * 60 * 1000).unref?.();

export function whatsappCodeAvailable(): boolean {
  const provider = getWhatsAppProvider();
  if (provider === "baileys") return true;
  return provider === "cloud" && Boolean(OTP_TEMPLATE);
}

export function smsCodeAvailable(): boolean {
  return isSmsConfigured();
}

export function phoneCodeChannels(): PhoneChannel[] {
  const out: PhoneChannel[] = [];
  if (whatsappCodeAvailable()) out.push("whatsapp");
  if (smsCodeAvailable()) out.push("sms");
  return out;
}

/** "+56 9 **** 5678" para mostrar a quién se envió sin exponer el número completo. */
export function maskPhone(to: string): string {
  const last = to.slice(-4);
  const cc = to.startsWith("56") ? "+56 9" : `+${to.slice(0, 2)}`;
  return `${cc} **** ${last}`;
}

function codeText(code: string): string {
  return `Tu codigo UZEED es ${code}. Vence en 10 minutos. No lo compartas con nadie.`;
}

type SendResult = { ok: boolean; status?: number; error?: string; messageId?: string };

async function sendWhatsAppCode(to: string, code: string): Promise<SendResult> {
  if (isBaileysEnabled()) {
    return sendBaileysText(to, `🔐 ${codeText(code)}`);
  }
  if (!OTP_TEMPLATE || !process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, error: "WHATSAPP_OTP_NOT_CONFIGURED" };
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
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: OTP_TEMPLATE,
            language: { code: OTP_TEMPLATE_LANG },
            // Formato de plantillas de autenticación: el código va en el
            // cuerpo y en el botón "Copiar código".
            components: [
              { type: "body", parameters: [{ type: "text", text: code }] },
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
            ],
          },
        }),
      },
    );
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = json?.error?.message || `HTTP_${res.status}`;
      console.error(`[phoneCode] whatsapp otp failed (${res.status}):`, error);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, messageId: json?.messages?.[0]?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || "NETWORK_ERROR" };
  }
}

export type PhoneCodeResult =
  | { ok: true; channel: PhoneChannel; destination: string; to: string }
  | { ok: false; error: "INVALID_PHONE" | "PHONE_DAILY_LIMIT" | "PHONE_CHANNEL_UNAVAILABLE" | "PHONE_SEND_FAILED" };

/**
 * Envía el código al teléfono. Intenta primero el canal preferido y, si falla
 * o no está disponible, el otro.
 */
export async function sendCodeToPhone(
  rawPhone: string,
  code: string,
  prefer: PhoneChannel = "whatsapp",
): Promise<PhoneCodeResult> {
  const to = normalizePhoneForWhatsApp(rawPhone);
  if (!to) return { ok: false, error: "INVALID_PHONE" };

  const order: PhoneChannel[] = prefer === "sms" ? ["sms", "whatsapp"] : ["whatsapp", "sms"];
  const channels = order.filter((c) => (c === "whatsapp" ? whatsappCodeAvailable() : smsCodeAvailable()));
  if (!channels.length) return { ok: false, error: "PHONE_CHANNEL_UNAVAILABLE" };

  const now = Date.now();
  const counter = sendsByPhone.get(to);
  if (counter && now - counter.windowStart < DAY_MS && counter.count >= MAX_SENDS_PER_PHONE_PER_DAY) {
    return { ok: false, error: "PHONE_DAILY_LIMIT" };
  }
  if (!counter || now - counter.windowStart >= DAY_MS) sendsByPhone.set(to, { count: 1, windowStart: now });
  else counter.count += 1;

  for (const channel of channels) {
    const result = channel === "whatsapp" ? await sendWhatsAppCode(to, code) : await sendSms(to, codeText(code));
    await logDelivery(prisma, {
      userId: null,
      channel: channel === "whatsapp" ? "WHATSAPP" : "SMS",
      type: "SIGNUP_CODE",
      result,
    });
    if (result.ok) return { ok: true, channel, destination: maskPhone(to), to };
    console.error(`[phoneCode] ${channel} failed for ${maskPhone(to)}:`, result.error);
  }
  return { ok: false, error: "PHONE_SEND_FAILED" };
}
