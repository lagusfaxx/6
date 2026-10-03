/**
 * Avisos por SMS vía LabsMobile (https://www.labsmobile.com).
 *
 * Se activa con LABSMOBILE_USER + LABSMOBILE_TOKEN. Se usa como respaldo de
 * WhatsApp: si WhatsApp no está configurado o el envío falla, el aviso sale
 * por SMS (ver maybeNotifyByWhatsApp en whatsapp.ts).
 *
 * Los textos se pasan a GSM-7 (sin tildes ni emojis) para que cada aviso
 * quepa en un solo SMS de 160 caracteres: con un solo carácter fuera de ese
 * alfabeto el límite baja a 70 y se cobran varios SMS.
 * Setup completo: docs/WHATSAPP_BOT.md
 */

type SendResult = { ok: boolean; status?: number; error?: string; messageId?: string };

const SMS_MAX_CHARS = 160;

export function isSmsConfigured(): boolean {
  return Boolean(process.env.LABSMOBILE_USER && process.env.LABSMOBILE_TOKEN);
}

/** Quita tildes, emojis y saltos de línea; conserva la ñ (está en GSM-7). */
export function toGsmText(text: string): string {
  return String(text || "")
    .replace(/ñ/g, "\u0000")
    .replace(/Ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "ñ")
    .replace(/\u0001/g, "Ñ")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7EñÑ¡¿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Envía un SMS. `to` en formato wa: solo dígitos con código país (569XXXXXXXX). */
export async function sendSms(to: string, text: string): Promise<SendResult> {
  const user = process.env.LABSMOBILE_USER;
  const token = process.env.LABSMOBILE_TOKEN;
  if (!user || !token) return { ok: false, error: "SMS_NOT_CONFIGURED" };

  const message = toGsmText(text).slice(0, SMS_MAX_CHARS);
  const body: Record<string, any> = { message, recipient: [{ msisdn: to }] };
  if (process.env.LABSMOBILE_SENDER) body.tpoa = process.env.LABSMOBILE_SENDER;

  try {
    const res = await fetch("https://api.labsmobile.com/json/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    // LabsMobile responde code "0" cuando el envío fue aceptado.
    if (!res.ok || String(json?.code) !== "0") {
      const error = json?.message ? `${json.code ?? res.status}: ${json.message}` : `HTTP_${res.status}`;
      console.error(`[sms] send failed (${res.status}):`, error);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, messageId: json?.subid };
  } catch (err: any) {
    console.error("[sms] send error:", err?.message || err);
    return { ok: false, error: err?.message || "NETWORK_ERROR" };
  }
}

/** Saldo de la cuenta LabsMobile en créditos (null si no se pudo consultar). */
export async function getSmsBalance(): Promise<number | null> {
  const user = process.env.LABSMOBILE_USER;
  const token = process.env.LABSMOBILE_TOKEN;
  if (!user || !token) return null;
  try {
    const res = await fetch("https://api.labsmobile.com/json/balance", {
      headers: { Authorization: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}` },
    });
    const json: any = await res.json().catch(() => ({}));
    const credits = Number(json?.credits);
    return res.ok && Number.isFinite(credits) ? credits : null;
  } catch {
    return null;
  }
}
