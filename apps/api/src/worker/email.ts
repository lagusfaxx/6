import { config } from "../config";
import { smtpConfigured, type MailResult } from "../lib/mailer";
import { sendNoticeEmail } from "../lib/notificationEmail";

/*
 * Correos de cobro del worker (prueba por terminar, perfil apagado, aviso de
 * cobro, membresía por vencer). Antes salían sólo por SMTP y, como UZEED usa
 * Resend y no tiene SMTP, no salía ninguno. Ahora van por lib/mailer (Resend,
 * con SMTP de respaldo si algún día se configura) con el diseño de UZEED.
 */

/** ¿Hay cómo mandar correos? (Resend o SMTP.) */
export function mailEnabled(): boolean {
  return Boolean(config.resendApiKey) || smtpConfigured();
}

/** @deprecated Usa `mailEnabled`: el nombre viene de cuando estos correos iban sólo por SMTP. */
export const smtpEnabled = mailEnabled;

const URL_RE = /(https?:\/\/[^\s]+[^\s.,;:!?)])/;

export async function sendExpiryEmail(to: string, expiresAt: Date): Promise<MailResult> {
  const when = expiresAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
  return sendBillingNoticeEmail(to, {
    subject: "Tu membresía UZEED está por vencer",
    title: "Tu membresía está por vencer",
    text: `Tu membresía vence el ${when}. Renuévala para que tu perfil siga apareciendo en UZEED.\n\n${config.appUrl.replace(/\/$/, "")}/pago`,
    ctaText: "Renovar mi plan",
  });
}

/**
 * Correo de aviso de cobro. `text` va en párrafos separados por una línea en
 * blanco; el primer enlace del texto se convierte también en el botón.
 */
export async function sendBillingNoticeEmail(
  to: string,
  opts: { subject: string; text: string; title?: string; ctaText?: string },
): Promise<MailResult> {
  if (!to) return { ok: false, reason: "NO_RECIPIENT" };
  if (!mailEnabled()) return { ok: false, reason: "MAIL_NOT_CONFIGURED" };
  const paragraphs = opts.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const link = opts.text.match(URL_RE)?.[1];
  try {
    const result = await sendNoticeEmail(to, {
      subject: opts.subject,
      title: opts.title || opts.subject,
      paragraphs,
      cta: link ? { text: opts.ctaText || "Entrar a UZEED", url: link } : undefined,
      text: opts.text,
    });
    if (!result.ok) console.error("[worker/email] billing notice failed", { to, reason: result.reason });
    return result;
  } catch (err: any) {
    console.error("[worker/email] billing notice failed", { to, err: err?.message || err });
    return { ok: false, reason: String(err?.message || err) };
  }
}
