import { Resend } from "resend";
import { config } from "../config";

function resendClient(): Resend | null {
  if (!config.resendApiKey) return null;
  return new Resend(config.resendApiKey);
}

function formatCLP(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Shared email layout wrapper ──
function wrapEmailHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#070816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070816;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1),rgba(59,130,246,0.08));border:1px solid rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding:40px 30px 20px;">
              <img src="https://uzeed.cl/brand/isotipo-new.png" alt="UZEED" width="80" height="80" style="display:block;border-radius:20px;" />
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td align="center" style="padding:0 30px 8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${title}</h1>
            </td>
          </tr>
          <!-- Content -->
          ${content}
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 30px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
                Este es un correo automático, no responder.<br/>
                &copy; UZEED &mdash; uzeed.cl
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Token purchase / deposit approved email ──
function buildDepositApprovedHtml(tokens: number, clpAmount: number, date: Date): string {
  const content = `
          <tr>
            <td align="center" style="padding:0 30px 24px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tu compra de tokens ha sido aprobada exitosamente.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Tokens adquiridos</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#e879f9;">${tokens}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Monto pagado</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${formatCLP(clpAmount)} CLP</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Fecha</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.8);">${formatDate(date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 32px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;">Los tokens ya están disponibles en tu billetera.</p>
            </td>
          </tr>`;
  return wrapEmailHtml("Compra de tokens confirmada", content);
}

// ── Withdrawal request confirmation email ──
function buildWithdrawalRequestHtml(tokens: number, clpAmount: number, date: Date): string {
  const content = `
          <tr>
            <td align="center" style="padding:0 30px 24px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Hemos recibido tu solicitud de retiro de tokens.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Tokens a retirar</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#e879f9;">${tokens}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Monto equivalente</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${formatCLP(clpAmount)} CLP</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Estado</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#fbbf24;">Pendiente de revisión</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Fecha de solicitud</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.8);">${formatDate(date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 32px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;">Te notificaremos cuando tu retiro sea procesado.</p>
            </td>
          </tr>`;
  return wrapEmailHtml("Solicitud de retiro recibida", content);
}

// ── Withdrawal approved email ──
function buildWithdrawalApprovedHtml(tokens: number, clpAmount: number, date: Date): string {
  const content = `
          <tr>
            <td align="center" style="padding:0 30px 24px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tu solicitud de retiro ha sido aprobada.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Tokens retirados</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#e879f9;">${tokens}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Monto</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${formatCLP(clpAmount)} CLP</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Estado</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#34d399;">Aprobado ✓</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Fecha</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.8);">${formatDate(date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 32px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;">El monto será transferido a tu cuenta bancaria registrada.</p>
            </td>
          </tr>`;
  return wrapEmailHtml("Retiro de tokens aprobado", content);
}

// ── Withdrawal rejected email ──
function buildWithdrawalRejectedHtml(tokens: number, clpAmount: number, reason: string | null, date: Date): string {
  const reasonLine = reason
    ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">${reason}</p>`
    : "";
  const content = `
          <tr>
            <td align="center" style="padding:0 30px 24px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tu solicitud de retiro no fue aprobada. Los tokens han sido devueltos a tu billetera.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Tokens</p>
                    <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#e879f9;">${tokens}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Monto</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${formatCLP(clpAmount)} CLP</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Estado</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#f87171;">Rechazado</p>
                    ${reasonLine}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;">Fecha</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.8);">${formatDate(date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 32px;">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5;">Los tokens han sido devueltos a tu billetera. Puedes verificar tu saldo en la app.</p>
            </td>
          </tr>`;
  return wrapEmailHtml("Retiro de tokens rechazado", content);
}

// ── Public send helpers ──

export async function sendDepositApprovedEmail(
  to: string,
  tokens: number,
  clpAmount: number,
): Promise<void> {
  const resend = resendClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping deposit approved email");
    return;
  }
  try {
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to,
      subject: "Compra de tokens confirmada — UZEED",
      html: buildDepositApprovedHtml(tokens, clpAmount, new Date()),
    });
  } catch (err) {
    console.error("[email] deposit approved email failed", err);
  }
}

export async function sendWithdrawalRequestEmail(
  to: string,
  tokens: number,
  clpAmount: number,
): Promise<void> {
  const resend = resendClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping withdrawal request email");
    return;
  }
  try {
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to,
      subject: "Solicitud de retiro recibida — UZEED",
      html: buildWithdrawalRequestHtml(tokens, clpAmount, new Date()),
    });
  } catch (err) {
    console.error("[email] withdrawal request email failed", err);
  }
}

export async function sendWithdrawalApprovedEmail(
  to: string,
  tokens: number,
  clpAmount: number,
): Promise<void> {
  const resend = resendClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping withdrawal approved email");
    return;
  }
  try {
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to,
      subject: "Retiro de tokens aprobado — UZEED",
      html: buildWithdrawalApprovedHtml(tokens, clpAmount, new Date()),
    });
  } catch (err) {
    console.error("[email] withdrawal approved email failed", err);
  }
}

export async function sendWithdrawalRejectedEmail(
  to: string,
  tokens: number,
  clpAmount: number,
  reason: string | null,
): Promise<void> {
  const resend = resendClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping withdrawal rejected email");
    return;
  }
  try {
    await resend.emails.send({
      from: "UZEED <no-reply@uzeed.cl>",
      to,
      subject: "Retiro de tokens rechazado — UZEED",
      html: buildWithdrawalRejectedHtml(tokens, clpAmount, reason, new Date()),
    });
  } catch (err) {
    console.error("[email] withdrawal rejected email failed", err);
  }
}
