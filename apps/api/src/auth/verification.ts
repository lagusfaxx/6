import { Router } from "express";
import { Resend } from "resend";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";

export const verificationRouter = Router();

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

interface PendingCode {
  code: string;
  expiresAt: number;
  lastSentAt: number;
  email: string;
}

const pendingCodes = new Map<string, PendingCode>();

// Cleanup expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingCodes) {
    if (entry.expiresAt < now) pendingCodes.delete(key);
  }
}, 5 * 60 * 1000);

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
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
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Verifica tu cuenta</h1>
            </td>
          </tr>
          <!-- Subtitle -->
          <tr>
            <td align="center" style="padding:0 30px 30px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Ingresa el siguiente código en la app para completar tu registro.</p>
            </td>
          </tr>
          <!-- Code box -->
          <tr>
            <td align="center" style="padding:0 30px 12px;">
              <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:24px 32px;display:inline-block;">
                <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#e879f9;font-family:'SF Mono',Consolas,monospace;">${code}</span>
              </div>
            </td>
          </tr>
          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:8px 30px 40px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Este código expira en 10 minutos.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 30px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
                Si no solicitaste este código, puedes ignorar este email.<br/>
                &copy; UZEED — uzeed.cl
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

verificationRouter.post(
  "/send-code",
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "EMAIL_REQUIRED" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = pendingCodes.get(normalizedEmail);

    if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000
      );
      return res.status(429).json({
        error: "COOLDOWN",
        message: `Debes esperar ${waitSeconds} segundos antes de reenviar.`,
        waitSeconds,
      });
    }

    const code = generateCode();
    pendingCodes.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
      lastSentAt: Date.now(),
      email: normalizedEmail,
    });

    if (config.resendApiKey) {
      try {
        const resend = new Resend(config.resendApiKey);
        await resend.emails.send({
          from: "UZEED <no-reply@uzeed.cl>",
          to: normalizedEmail,
          subject: `${code} — Código de verificación UZEED`,
          html: buildEmailHtml(code),
        });
      } catch (err) {
        console.error("[verification] resend failed", err);
        return res
          .status(500)
          .json({ error: "EMAIL_SEND_FAILED", message: "No se pudo enviar el correo." });
      }
    } else {
      console.warn("[verification] RESEND_API_KEY not set, code:", code);
    }

    return res.json({ ok: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  })
);

verificationRouter.post(
  "/verify-code",
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = pendingCodes.get(normalizedEmail);

    if (!entry) {
      return res
        .status(400)
        .json({ error: "CODE_NOT_FOUND", message: "No hay un código pendiente para este email." });
    }

    if (Date.now() > entry.expiresAt) {
      pendingCodes.delete(normalizedEmail);
      return res
        .status(400)
        .json({ error: "CODE_EXPIRED", message: "El código ha expirado. Solicita uno nuevo." });
    }

    if (entry.code !== String(code).trim()) {
      return res
        .status(400)
        .json({ error: "CODE_INVALID", message: "El código ingresado no es correcto." });
    }

    pendingCodes.delete(normalizedEmail);
    return res.json({ ok: true, verified: true });
  })
);
