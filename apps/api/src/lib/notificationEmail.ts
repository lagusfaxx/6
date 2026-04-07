import { Resend } from "resend";
import { config } from "../config";

/* ─── HTML escape to prevent XSS in email templates ─── */

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

export async function sendNoPhotoReminder(email: string, displayName: string | null) {
  const name = esc(displayName || "profesional");
  const html = wrapEmail(
    "¡Sube tu primera foto!",
    [
      paragraph(`Hola ${name}, te registraste en UZEED pero aún no has subido ninguna foto a tu perfil.`),
      paragraph("Los perfiles con fotos reciben <strong>hasta 10x más visitas</strong> y mensajes. ¡No te quedes atrás!"),
      ctaButton("Subir fotos ahora", `${config.appUrl}/dashboard/services`),
    ].join(""),
  );
  await send(email, "¡Tu perfil necesita fotos! — UZEED", html);
}

/* ─── Reminder: inactive profile (48h without login or photos) ─── */

export async function sendInactiveProfileReminder(email: string, displayName: string | null) {
  const name = esc(displayName || "profesional");
  const html = wrapEmail(
    "Te extrañamos en UZEED",
    [
      paragraph(`Hola ${name}, hace más de 48 horas que no ingresas a UZEED.`),
      paragraph("Tus potenciales clientes te están buscando. Mantén tu perfil activo para aparecer en los primeros resultados."),
      ctaButton("Volver a UZEED", `${config.appUrl}`),
    ].join(""),
  );
  await send(email, "Tu perfil está perdiendo visibilidad — UZEED", html);
}

/* ─── Reminder: videocall service added but not configured ─── */

export async function sendVideocallConfigReminder(email: string, displayName: string | null) {
  const name = esc(displayName || "profesional");
  const html = wrapEmail(
    "Configura tus videollamadas",
    [
      paragraph(`Hola ${name}, agregaste el servicio de videollamadas pero aún no has configurado tus horarios ni precios.`),
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
      paragraph(`¡Tienes una nueva videollamada agendada con <strong>${esc(data.clientName)}</strong>!`),
      row("Cliente", esc(data.clientName)),
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
      paragraph(`<strong>${esc(data.clientName)}</strong> ha solicitado un encuentro contigo.`),
      row("Cliente", esc(data.clientName)),
      row("Fecha solicitada", esc(data.requestedDate)),
      row("Hora solicitada", esc(data.requestedTime)),
      row("Ubicación", esc(data.location)),
      ...(data.clientComment ? [row("Comentario", esc(data.clientComment))] : []),
      statusBadge("PENDIENTE DE APROBACIÓN", "rgba(245,158,11,0.8)"),
      ctaButton("Ver solicitud", `${config.appUrl}/dashboard/services`),
    ].join(""),
  );
  await send(email, `Nueva solicitud de encuentro de ${data.clientName} — UZEED`, html);
}

/* ─── Quality review email (admin "catador") ─── */

function ratingBar(score: number): string {
  const pct = Math.round((score / 10) * 100);
  const color = score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";
  return `<div style="display:flex;align-items:center;gap:8px;">
    <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
    </div>
    <span style="font-size:13px;font-weight:700;color:${color};min-width:28px;text-align:right;">${score}/10</span>
  </div>`;
}

function ratingRow(label: string, score: number): string {
  return `<tr><td style="padding:4px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:rgba(255,255,255,0.5);padding:6px 0;width:45%;">${label}</td>
        <td style="padding:6px 0;">${ratingBar(score)}</td>
      </tr>
    </table>
  </td></tr>`;
}

/* ─── Campaign: referral program invitation for creators ─── */

export async function sendReferralCampaignEmail(
  email: string,
  data: {
    displayName: string | null;
    referralCode: string;
  },
) {
  const name = esc(data.displayName || "creadora");
  const code = esc(data.referralCode);

  const html = wrapEmail(
    "Gana hasta $650.000 invitando creadoras",
    [
      paragraph(
        `Hola <strong>${name}</strong>, tenemos una nueva forma de que ganes dinero en UZEED: ` +
        `<strong>nuestro Programa de Referidos.</strong>`,
      ),

      // Highlight code
      `<tr><td align="center" style="padding:12px 30px 20px;">
        <div style="background:rgba(168,85,247,0.2);border:2px dashed rgba(168,85,247,0.6);border-radius:16px;padding:20px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;">Tu codigo de referido</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#a855f7;letter-spacing:0.05em;">${code}</p>
        </div>
      </td></tr>`,

      paragraph(
        "Comparte tu codigo con profesionales que quieran registrarse en UZEED. " +
        "Por cada una que se registre y cumpla las condiciones, <strong>ganas $10.000 CLP.</strong>",
      ),

      // Earnings table
      `<tr><td style="padding:8px 30px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;">
          <tr style="background:rgba(168,85,247,0.15);">
            <td style="padding:10px 16px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.05em;">Referidas</td>
            <td align="right" style="padding:10px 16px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.05em;">Ganas</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;font-size:14px;color:rgba(255,255,255,0.6);border-bottom:1px solid rgba(255,255,255,0.06);">10 profesionales</td>
            <td align="right" style="padding:8px 16px;font-size:14px;font-weight:700;color:#10b981;border-bottom:1px solid rgba(255,255,255,0.06);">$100.000</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;font-size:14px;color:rgba(255,255,255,0.6);border-bottom:1px solid rgba(255,255,255,0.06);">15 profesionales</td>
            <td align="right" style="padding:8px 16px;font-size:14px;font-weight:700;color:#10b981;border-bottom:1px solid rgba(255,255,255,0.06);">$200.000</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;font-size:14px;color:rgba(255,255,255,0.6);border-bottom:1px solid rgba(255,255,255,0.06);">20 profesionales</td>
            <td align="right" style="padding:8px 16px;font-size:14px;font-weight:700;color:#10b981;border-bottom:1px solid rgba(255,255,255,0.06);">$350.000</td>
          </tr>
          <tr>
            <td style="padding:8px 16px;font-size:14px;color:rgba(255,255,255,0.6);">30 profesionales</td>
            <td align="right" style="padding:8px 16px;font-size:15px;font-weight:800;color:#a855f7;">$650.000</td>
          </tr>
        </table>
      </td></tr>`,

      // Conditions section
      `<tr><td style="padding:8px 30px 4px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.8);">Condiciones de la promocion:</p>
      </td></tr>`,
      `<tr><td style="padding:4px 30px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;">
            ✓ La profesional debe registrarse con tu codigo<br/>
            ✓ Debe verificar su perfil con UZEED<br/>
            ✓ Debe subir al menos 1 foto a su perfil<br/>
            ✓ Su cuenta debe estar activa por minimo 48 horas<br/>
            ✓ Minimo 10 referidas validadas para recibir el pago<br/>
            ✓ Ciclo de 20 dias — se reinicia automaticamente<br/>
            ✓ El pago se realiza al finalizar cada ciclo exitoso
          </td></tr>
        </table>
      </td></tr>`,

      paragraph(
        "<strong>Mientras mas compartas, mas ganas.</strong> Los bonos son acumulables: " +
        "al llegar a 15 recibes un bonus de $50.000, a 20 recibes otro de $100.000, " +
        "y a 30 un mega bonus de $200.000.",
      ),

      ctaButton("Ver mi programa de referidos", `${config.appUrl}/dashboard/referidos`),

      paragraph(
        `<span style="font-size:12px;color:rgba(255,255,255,0.35);">` +
        `Promocion vigente por tiempo limitado. UZEED se reserva el derecho de modificar ` +
        `las condiciones del programa. Solo aplica para profesionales nuevas que no tengan ` +
        `cuenta previa en la plataforma. No se permiten auto-referidos.</span>`,
      ),
    ].join(""),
  );
  await send(email, `Gana hasta $650.000 con tu codigo ${code} — UZEED`, html);
}

export async function sendQualityReviewEmail(
  email: string,
  data: {
    professionalName: string;
    ratingPhotoQuality: number;
    ratingCompleteness: number;
    ratingPresentation: number;
    ratingAuthenticity: number;
    ratingValue: number;
    overallScore: number;
  },
) {
  const name = esc(data.professionalName || "profesional");
  const scoreColor = data.overallScore >= 7 ? "rgba(16,185,129,0.8)"
    : data.overallScore >= 5 ? "rgba(245,158,11,0.8)"
    : "rgba(239,68,68,0.8)";

  const suggestions: string[] = [];
  if (data.ratingPhotoQuality < 6) suggestions.push("Sube fotos de mejor calidad y buena iluminacion");
  if (data.ratingCompleteness < 6) suggestions.push("Completa tu biografia, servicios y tarifas");
  if (data.ratingPresentation < 6) suggestions.push("Mejora la presentacion general de tu anuncio");
  if (data.ratingAuthenticity < 6) suggestions.push("Agrega fotos mas naturales y verificaciones");
  if (data.ratingValue < 6) suggestions.push("Destaca lo que te hace unica y tus servicios especiales");

  const suggestionsHtml = suggestions.length > 0
    ? paragraph(`<strong>Sugerencias de mejora:</strong><br/>` + suggestions.map(s => `• ${s}`).join("<br/>"))
    : paragraph("¡Tu perfil se ve excelente! Sigue asi.");

  const html = wrapEmail(
    "Evaluacion de calidad de tu perfil",
    [
      paragraph(`Hola ${name}, nuestro equipo ha evaluado la calidad de tu perfil en UZEED.`),
      statusBadge(`Puntuacion: ${data.overallScore.toFixed(1)}/10`, scoreColor),
      ratingRow("Calidad de fotos", data.ratingPhotoQuality),
      ratingRow("Completitud del perfil", data.ratingCompleteness),
      ratingRow("Presentacion", data.ratingPresentation),
      ratingRow("Autenticidad", data.ratingAuthenticity),
      ratingRow("Propuesta de valor", data.ratingValue),
      suggestionsHtml,
      ctaButton("Mejorar mi perfil", `${config.appUrl}/dashboard/services`),
    ].join(""),
  );
  await send(email, `Evaluacion de calidad de tu perfil — UZEED`, html);
}

/* ─── Gold plan renewal reminder ─── */

export async function sendGoldRenewalEmail(email: string, displayName: string | null) {
  const name = esc(displayName || "profesional");
  const html = wrapEmail(
    "Tu plan Gold expira pronto",
    [
      paragraph(`Hola ${name}, tu plan <strong>Gold</strong> en UZEED está por vencer.`),
      paragraph("Si no renuevas, tu perfil bajará a visibilidad básica (Silver) y perderás el badge Gold, la prioridad en búsquedas y los contactos x5."),
      row("Plan", "Gold — 7 días"),
      row("Precio", "$14.990 CLP"),
      ctaButton("Renovar plan Gold", `${config.appUrl}/publicate`),
    ].join(""),
  );
  await send(email, "Tu plan Gold expira pronto — Renueva por $14.990", html);
}
