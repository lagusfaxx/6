import { Resend } from "resend";
import { config } from "../config";

/* ─── Shared UZEED email template ─── */

function wrapEmail(title: string, contentRows: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#070816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070816;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1),rgba(59,130,246,0.08));border:1px solid rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;">
      <tr><td align="center" style="padding:40px 30px 20px;">
        <img src="https://uzeed.cl/brand/isotipo-new.png" alt="UZEED" width="80" height="80" style="display:block;border-radius:20px;" />
      </td></tr>
      <tr><td align="center" style="padding:0 30px 8px;">
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${title}</h1>
      </td></tr>
      ${contentRows}
      <tr><td align="center" style="padding:20px 30px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
          Este correo fue enviado automáticamente.<br/>&copy; UZEED — uzeed.cl
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:rgba(255,255,255,0.5);padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">${label}</td>
        <td align="right" style="font-size:14px;font-weight:600;color:#ffffff;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">${value}</td>
      </tr>
    </table>
  </td></tr>`;
}

function paragraph(text: string): string {
  return `<tr><td align="center" style="padding:0 30px 20px;"><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">${text}</p></td></tr>`;
}

function ctaButton(text: string, url: string): string {
  return `<tr><td align="center" style="padding:16px 30px 24px;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#ec4899);border-radius:12px;padding:12px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">
      ${text}
    </a>
  </td></tr>`;
}

function statusBadge(status: string, color: string): string {
  return `<tr><td align="center" style="padding:16px 30px 24px;">
    <div style="display:inline-block;background:${color};border-radius:20px;padding:6px 18px;font-size:12px;font-weight:700;color:#ffffff;letter-spacing:0.03em;">
      ${status}
    </div>
  </td></tr>`;
}

async function send(to: string, subject: string, html: string) {
  if (!config.resendApiKey) return;
  try {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[notificationEmail] failed", { to, subject, err });
  }
}

/* ─── Reminder: profile has no photos after 5 hours ─── */

export async function sendNoPhotoReminder(email: string, displayName: string) {
  const html = wrapEmail(
    "¡Sube tu primera foto!",
    [
      paragraph(`Hola ${displayName}, te registraste en UZEED pero aún no has subido ninguna foto a tu perfil.`),
      paragraph("Los perfiles con fotos reciben <strong>hasta 10x más visitas</strong> y mensajes. ¡No te quedes atrás!"),
      ctaButton("Subir fotos ahora", `${config.appUrl}/dashboard/services`),
    ].join(""),
  );
  await send(email, "¡Tu perfil necesita fotos! — UZEED", html);
}

/* ─── Reminder: inactive profile (48h without login or photos) ─── */

export async function sendInactiveProfileReminder(email: string, displayName: string) {
  const html = wrapEmail(
    "Te extrañamos en UZEED",
    [
      paragraph(`Hola ${displayName}, hace más de 48 horas que no ingresas a UZEED.`),
      paragraph("Tus potenciales clientes te están buscando. Mantén tu perfil activo para aparecer en los primeros resultados."),
      ctaButton("Volver a UZEED", `${config.appUrl}`),
    ].join(""),
  );
  await send(email, "Tu perfil está perdiendo visibilidad — UZEED", html);
}

/* ─── Reminder: videocall service added but not configured ─── */

export async function sendVideocallConfigReminder(email: string, displayName: string) {
  const html = wrapEmail(
    "Configura tus videollamadas",
    [
      paragraph(`Hola ${displayName}, agregaste el servicio de videollamadas pero aún no has configurado tus horarios ni precios.`),
      paragraph("Sin configuración, los clientes no podrán agendar videollamadas contigo. Configúralo en unos minutos."),
      ctaButton("Configurar videollamadas", `${config.appUrl}/videocall`),
    ].join(""),
  );
  await send(email, "Configura tus videollamadas — UZEED", html);
}

/* ─── Confirmation: videocall booking ─── */

export async function sendVideocallBookingConfirmation(
  email: string,
  data: {
    professionalName: string;
    clientName: string;
    scheduledAt: Date;
    durationMinutes: number;
    totalTokens: number;
  },
) {
  const dateStr = data.scheduledAt.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = data.scheduledAt.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });

  const html = wrapEmail(
    "Nueva videollamada agendada",
    [
      paragraph(`¡Tienes una nueva videollamada agendada con <strong>${data.clientName}</strong>!`),
      row("Cliente", data.clientName),
      row("Fecha", dateStr),
      row("Hora (Chile)", timeStr),
      row("Duración", `${data.durationMinutes} minutos`),
      row("Tokens", `${data.totalTokens}`),
      statusBadge("CONFIRMADA", "rgba(16,185,129,0.8)"),
      ctaButton("Ver mis videollamadas", `${config.appUrl}/videocall`),
    ].join(""),
  );
  await send(email, `Videollamada agendada con ${data.clientName} — UZEED`, html);
}

/* ─── Confirmation: encounter / service request ─── */

export async function sendServiceRequestConfirmation(
  email: string,
  data: {
    professionalName: string;
    clientName: string;
    requestedDate: string;
    requestedTime: string;
    location: string;
    clientComment?: string | null;
  },
) {
  const html = wrapEmail(
    "Nueva solicitud de encuentro",
    [
      paragraph(`<strong>${data.clientName}</strong> ha solicitado un encuentro contigo.`),
      row("Cliente", data.clientName),
      row("Fecha solicitada", data.requestedDate),
      row("Hora solicitada", data.requestedTime),
      row("Ubicación", data.location),
      ...(data.clientComment ? [row("Comentario", data.clientComment)] : []),
      statusBadge("PENDIENTE DE APROBACIÓN", "rgba(245,158,11,0.8)"),
      ctaButton("Ver solicitud", `${config.appUrl}/dashboard/services`),
    ].join(""),
  );
  await send(email, `Nueva solicitud de encuentro de ${data.clientName} — UZEED`, html);
}
