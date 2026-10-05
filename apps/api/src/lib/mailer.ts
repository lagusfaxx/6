import { Resend } from "resend";
import nodemailer from "nodemailer";
import { config } from "../config";

/**
 * Envío central de correos.
 *
 * Prioridades:
 * - "critical": códigos de registro, recuperación de contraseña, crear contraseña.
 *   Si Resend falla (p. ej. cuota diaria agotada) se intenta por SMTP.
 * - "normal": transaccionales (pagos, pedidos, reservas, avisos del admin).
 *   Mismo fallback a SMTP.
 * - "bulk": recordatorios, campañas, avisos de mensajes sin leer. Nunca usan
 *   SMTP y se saltan mientras Resend esté sin cuota, para no competir con los
 *   códigos de registro. Se pueden pausar con EMAIL_BULK_PAUSED=true o limitar
 *   con EMAIL_BULK_DAILY_CAP (por proceso, por día UTC).
 *
 * Ojo: el SDK de Resend NO lanza excepción cuando el envío falla; devuelve
 * `{ error }`. Antes se ignoraba ese error y todo parecía enviado.
 */

export type MailPriority = "critical" | "normal" | "bulk";

export type MailResult =
  | { ok: true; provider: "resend" | "smtp" }
  | { ok: false; reason: string };

const FROM = "UZEED <no-reply@uzeed.cl>";

const QUOTA_BLOCK_MS: Record<string, number> = {
  daily_quota_exceeded: 60 * 60 * 1000, // se vuelve a probar cada hora
  monthly_quota_exceeded: 6 * 60 * 60 * 1000,
};

let resendBlockedUntil = 0;
let resendBlockReason = "";
let resendClient: Resend | null = null;
let smtpTransport: nodemailer.Transporter | null = null;

let bulkDay = "";
let bulkSentToday = 0;

function resend(): Resend | null {
  if (!config.resendApiKey) return null;
  if (!resendClient) resendClient = new Resend(config.resendApiKey);
  return resendClient;
}

export function smtpConfigured(): boolean {
  const s = config.smtp;
  return !!(s.host && s.port && s.user && s.pass && s.from);
}

function smtp(): nodemailer.Transporter | null {
  if (!smtpConfigured()) return null;
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: config.smtp.host!,
      port: config.smtp.port!,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user!, pass: config.smtp.pass! },
    });
  }
  return smtpTransport;
}

function resendBlocked(): boolean {
  return Date.now() < resendBlockedUntil;
}

/** Estado actual, útil para logs o un endpoint de salud. */
export function mailerStatus() {
  return {
    resendConfigured: !!config.resendApiKey,
    smtpConfigured: smtpConfigured(),
    resendBlocked: resendBlocked(),
    resendBlockedUntil: resendBlocked() ? new Date(resendBlockedUntil).toISOString() : null,
    resendBlockReason: resendBlocked() ? resendBlockReason : null,
    bulkSentToday,
  };
}

function bulkAllowed(): string | null {
  if (process.env.EMAIL_BULK_PAUSED === "true") return "BULK_PAUSED";
  if (resendBlocked()) return "RESEND_QUOTA";
  const today = new Date().toISOString().slice(0, 10);
  if (today !== bulkDay) {
    bulkDay = today;
    bulkSentToday = 0;
  }
  const cap = Number(process.env.EMAIL_BULK_DAILY_CAP || 0);
  if (cap > 0 && bulkSentToday >= cap) return "BULK_DAILY_CAP";
  return null;
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<MailResult> {
  const client = resend();
  if (!client) return { ok: false, reason: "RESEND_NOT_CONFIGURED" };

  for (let attempt = 0; attempt < 2; attempt++) {
    let error: { name?: string; message?: string; statusCode?: number | null } | null;
    try {
      ({ error } = await client.emails.send({ from: FROM, to, subject, html }));
    } catch (err: any) {
      error = { name: "exception", message: err?.message ?? String(err) };
    }
    if (!error) return { ok: true, provider: "resend" };

    const name = error.name ?? "unknown";
    if (name in QUOTA_BLOCK_MS) {
      if (!resendBlocked()) {
        console.error(`[mailer] Resend sin cuota (${name}); se pausan envíos masivos y se usa SMTP si está configurado`);
      }
      resendBlockedUntil = Date.now() + QUOTA_BLOCK_MS[name];
      resendBlockReason = name;
      return { ok: false, reason: name };
    }
    if (name === "rate_limit_exceeded" && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1100));
      continue;
    }
    console.error("[mailer] Resend error", { to, subject, name, message: error.message });
    return { ok: false, reason: name };
  }
  return { ok: false, reason: "rate_limit_exceeded" };
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<MailResult> {
  const transport = smtp();
  if (!transport) return { ok: false, reason: "SMTP_NOT_CONFIGURED" };
  try {
    await transport.sendMail({ from: config.smtp.from!, to, subject, html, text });
    return { ok: true, provider: "smtp" };
  } catch (err: any) {
    console.error("[mailer] SMTP error", { to, subject, err: err?.message ?? err });
    return { ok: false, reason: "SMTP_FAILED" };
  }
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority?: MailPriority;
}): Promise<MailResult> {
  const { to, subject, html, text } = opts;
  const priority = opts.priority ?? "normal";
  if (!to) return { ok: false, reason: "NO_RECIPIENT" };

  if (priority === "bulk") {
    const blocked = bulkAllowed();
    if (blocked) return { ok: false, reason: blocked };
    const result = await sendViaResend(to, subject, html);
    if (result.ok) bulkSentToday += 1;
    return result;
  }

  // Crítico / normal: si sabemos que Resend está sin cuota y hay SMTP, vamos
  // directo a SMTP. Si no hay SMTP, igual se intenta Resend (no hay nada que perder).
  if (!(resendBlocked() && smtpConfigured())) {
    const result = await sendViaResend(to, subject, html);
    if (result.ok) return result;
    if (!smtpConfigured()) {
      if (priority === "critical") {
        console.error(`[mailer] correo crítico NO enviado a ${to} (${result.reason}) y no hay SMTP configurado`);
      }
      return result;
    }
  }

  const fallback = await sendViaSmtp(to, subject, html, text);
  if (fallback.ok) console.warn(`[mailer] enviado por SMTP (fallback) a ${to}: ${subject}`);
  return fallback;
}
