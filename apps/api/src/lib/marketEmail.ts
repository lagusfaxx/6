import { Resend } from "resend";
import { config } from "../config";

/**
 * Correos del marketplace. Mismo envoltorio visual que el resto de los avisos
 * de UZEED. Nunca se incluye el contenido comprado ni la dirección completa:
 * el correo puede quedar visible en un equipo compartido.
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

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clp(value: number): string {
  return `$${Math.round(value || 0).toLocaleString("es-CL")}`;
}

function appUrl(path: string): string {
  return `${(config.appUrl || "https://uzeed.cl").replace(/\/$/, "")}${path}`;
}

async function send(to: string | null | undefined, subject: string, html: string) {
  if (!config.resendApiKey || !to) return;
  try {
    const resend = new Resend(config.resendApiKey);
    await resend.emails.send({ from: "UZEED <no-reply@uzeed.cl>", to, subject, html });
  } catch (err) {
    console.error("[marketEmail] failed", { to, subject, err });
  }
}

const DELIVERY_LABEL: Record<string, string> = {
  DIGITAL: "Entrega digital",
  MEET: "Entrega acordada",
  SHIPPING: "Envío a domicilio",
};

export async function sendMarketOrderPaidEmail(
  email: string | null | undefined,
  data: {
    forSeller: boolean;
    name: string;
    code: string;
    productTitle: string;
    amountClp: number;
    deliveryMethod: string;
    autoDelivered: boolean;
    holdDays: number;
  },
) {
  const rows = [
    row("Pedido", escapeHtml(data.code)),
    row("Artículo", escapeHtml(data.productTitle)),
    row("Entrega", DELIVERY_LABEL[data.deliveryMethod] || data.deliveryMethod),
    row(data.forSeller ? "Recibes" : "Total pagado", clp(data.amountClp)),
  ].join("");

  if (data.forSeller) {
    const html = wrapEmail(
      "Vendiste un artículo 🎉",
      paragraph(`Hola ${escapeHtml(data.name)}, tienes una venta nueva en el marketplace.`) +
        rows +
        paragraph(
          data.autoDelivered
            ? `El contenido se entregó automáticamente. El pago se libera cuando la clienta confirme la recepción o a los ${data.holdDays} días.`
            : `Entra al pedido para coordinar la entrega. El pago se libera cuando la clienta confirme la recepción o a los ${data.holdDays} días.`,
        ) +
        ctaButton("Ver el pedido", appUrl("/marketplace/vender?tab=pedidos")),
    );
    return send(email, `Nueva venta ${data.code} — UZEED`, html);
  }

  const html = wrapEmail(
    "Pago confirmado",
    paragraph(`Hola ${escapeHtml(data.name)}, tu pago quedó confirmado.`) +
      rows +
      paragraph(
        data.autoDelivered
          ? "Tu contenido ya está disponible dentro de UZEED, en tus compras."
          : "La vendedora ya fue notificada y coordinará la entrega contigo.",
      ) +
      ctaButton("Ver mi compra", appUrl("/marketplace/compras")),
  );
  return send(email, `Pago confirmado ${data.code} — UZEED`, html);
}

export async function sendMarketPayoutReleasedEmail(
  email: string | null | undefined,
  data: { name: string; code: string; amountClp: number; auto: boolean },
) {
  const html = wrapEmail(
    "Pago liberado",
    paragraph(`Hola ${escapeHtml(data.name)}, el dinero de tu venta quedó disponible.`) +
      row("Pedido", escapeHtml(data.code)) +
      row("Disponible", clp(data.amountClp)) +
      paragraph(
        data.auto
          ? "Se liberó automáticamente al cumplirse el plazo de retención."
          : "La clienta confirmó que recibió el pedido.",
      ) +
      ctaButton("Ver mis ganancias", appUrl("/marketplace/vender?tab=ganancias")),
  );
  return send(email, `Pago liberado ${data.code} — UZEED`, html);
}

export async function sendMarketTransferInstructionsEmail(
  email: string | null | undefined,
  data: {
    name: string;
    code: string;
    amountClp: number;
    bank: { bankName: string | null; accountType: string | null; accountNumber: string | null; holderName: string | null; holderRut: string | null; email: string | null };
  },
) {
  const html = wrapEmail(
    "Datos para tu transferencia",
    paragraph(`Hola ${escapeHtml(data.name)}, transfiere el total y sube el comprobante para que confirmemos tu pedido.`) +
      row("Pedido", escapeHtml(data.code)) +
      row("Monto", clp(data.amountClp)) +
      row("Banco", escapeHtml(data.bank.bankName || "—")) +
      row("Tipo de cuenta", escapeHtml(data.bank.accountType || "—")) +
      row("N° de cuenta", escapeHtml(data.bank.accountNumber || "—")) +
      row("Titular", escapeHtml(data.bank.holderName || "—")) +
      row("RUT", escapeHtml(data.bank.holderRut || "—")) +
      row("Correo", escapeHtml(data.bank.email || "—")) +
      paragraph("Usa el código del pedido como comentario de la transferencia.") +
      ctaButton("Subir comprobante", appUrl("/marketplace/compras")),
  );
  return send(email, `Transferencia pendiente ${data.code} — UZEED`, html);
}

export async function sendMarketOrderDeliveredEmail(
  email: string | null | undefined,
  data: { name: string; code: string; productTitle: string; trackingCode?: string | null; holdDays: number },
) {
  const html = wrapEmail(
    "Tu pedido fue entregado",
    paragraph(`Hola ${escapeHtml(data.name)}, la vendedora marcó tu pedido como entregado.`) +
      row("Pedido", escapeHtml(data.code)) +
      row("Artículo", escapeHtml(data.productTitle)) +
      (data.trackingCode ? row("Seguimiento", escapeHtml(data.trackingCode)) : "") +
      paragraph(
        `Confirma que lo recibiste para liberar el pago. Si no lo haces, se libera solo a los ${data.holdDays} días del pago.`,
      ) +
      ctaButton("Confirmar recepción", appUrl("/marketplace/compras")),
  );
  return send(email, `Pedido entregado ${data.code} — UZEED`, html);
}
