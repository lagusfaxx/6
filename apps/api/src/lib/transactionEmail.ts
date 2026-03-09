import { Resend } from "resend";
import { config } from "../config";

/**
 * Build the shared UZEED email wrapper (same look as verification emails).
 */
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

function statusBadge(status: string, color: string): string {
  return `<tr><td align="center" style="padding:16px 30px 24px;">
    <div style="display:inline-block;background:${color};border-radius:20px;padding:6px 18px;font-size:12px;font-weight:700;color:#ffffff;letter-spacing:0.03em;">
      ${status}
    </div>
  </td></tr>`;
}

/* ─── Public helpers ─── */

export async function sendDepositConfirmationEmail(
  email: string,
  data: { tokens: number; clpAmount: number; date: Date },
) {
  if (!config.resendApiKey) return;
  const dateStr = data.date.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const html = wrapEmail(
    "Compra de tokens confirmada",
    [
      `<tr><td align="center" style="padding:0 30px 20px;"><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tu compra fue registrada exitosamente.</p></td></tr>`,
      row("Tokens", `${data.tokens}`),
      row("Monto", `$${data.clpAmount.toLocaleString("es-CL")} CLP`),
      row("Fecha", dateStr),
      statusBadge("PENDIENTE DE APROBACIÓN", "rgba(245,158,11,0.8)"),
    ].join(""),
  );
  try {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to: email,
      subject: "Compra de tokens registrada — UZEED",
      html,
    });
  } catch (err) {
    console.error("[transactionEmail] deposit confirmation failed", err);
  }
}

export async function sendDepositApprovedEmail(
  email: string,
  data: { tokens: number; clpAmount: number },
) {
  if (!config.resendApiKey) return;
  const html = wrapEmail(
    "Tokens acreditados",
    [
      `<tr><td align="center" style="padding:0 30px 20px;"><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tus tokens han sido acreditados en tu billetera.</p></td></tr>`,
      row("Tokens acreditados", `${data.tokens}`),
      row("Monto pagado", `$${data.clpAmount.toLocaleString("es-CL")} CLP`),
      statusBadge("APROBADO", "rgba(16,185,129,0.8)"),
    ].join(""),
  );
  try {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to: email,
      subject: "Tokens acreditados en tu billetera — UZEED",
      html,
    });
  } catch (err) {
    console.error("[transactionEmail] deposit approved email failed", err);
  }
}

export async function sendWithdrawalConfirmationEmail(
  email: string,
  data: { tokens: number; clpAmount: number; bankName: string; date: Date },
) {
  if (!config.resendApiKey) return;
  const dateStr = data.date.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
  const html = wrapEmail(
    "Solicitud de retiro registrada",
    [
      `<tr><td align="center" style="padding:0 30px 20px;"><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tu solicitud de retiro está siendo procesada.</p></td></tr>`,
      row("Tokens a retirar", `${data.tokens}`),
      row("Monto estimado", `$${data.clpAmount.toLocaleString("es-CL")} CLP`),
      row("Banco destino", data.bankName),
      row("Fecha", dateStr),
      statusBadge("EN PROCESO", "rgba(245,158,11,0.8)"),
    ].join(""),
  );
  try {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to: email,
      subject: "Solicitud de retiro registrada — UZEED",
      html,
    });
  } catch (err) {
    console.error("[transactionEmail] withdrawal confirmation failed", err);
  }
}

export async function sendWithdrawalApprovedEmail(
  email: string,
  data: { tokens: number; clpAmount: number; bankName: string },
) {
  if (!config.resendApiKey) return;
  const html = wrapEmail(
    "Retiro aprobado",
    [
      `<tr><td align="center" style="padding:0 30px 20px;"><p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tu retiro fue aprobado y será depositado en tu cuenta bancaria.</p></td></tr>`,
      row("Tokens retirados", `${data.tokens}`),
      row("Monto a depositar", `$${data.clpAmount.toLocaleString("es-CL")} CLP`),
      row("Banco destino", data.bankName),
      statusBadge("APROBADO", "rgba(16,185,129,0.8)"),
    ].join(""),
  );
  try {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to: email,
      subject: "Retiro aprobado — UZEED",
      html,
    });
  } catch (err) {
    console.error("[transactionEmail] withdrawal approved email failed", err);
  }
}
