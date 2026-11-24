import type { NextFunction, Request, Response } from "express";

/**
 * Cloudflare Turnstile (captcha invisible) para el registro: frena la creación
 * de cuentas falsas en masa sin molestar a las personas.
 *
 * Queda APAGADO mientras no estén las dos variables TURNSTILE_SITE_KEY y
 * TURNSTILE_SECRET_KEY en la API. La web pide la clave del sitio a
 * /billing/public-config y sólo muestra el captcha si viene; así se enciende o
 * se apaga sin volver a compilar la web.
 *
 * Si Cloudflare no responde, el registro sigue: que una caída de Turnstile no
 * deje a nadie sin poder registrarse.
 */
export function turnstileSiteKey(): string | null {
  const site = (process.env.TURNSTILE_SITE_KEY || "").trim();
  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  return site && secret ? site : null;
}

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type VerifyResult = "ok" | "rejected" | "unavailable";

async function verifyToken(token: string, ip: string | undefined): Promise<VerifyResult> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return "unavailable";
    const data = (await res.json()) as { success?: boolean };
    return data.success ? "ok" : "rejected";
  } catch {
    return "unavailable";
  }
}

/** Middleware: exige un token válido de Turnstile si está configurado. */
export async function requireTurnstile(req: Request, res: Response, next: NextFunction) {
  if (!turnstileSiteKey()) return next();
  const token = typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken.trim() : "";
  if (!token) {
    return res.status(400).json({
      error: "CAPTCHA_REQUIRED",
      message: "Confirma que no eres un robot e intenta de nuevo.",
    });
  }
  const result = await verifyToken(token, req.ip);
  if (result === "rejected") {
    return res.status(400).json({
      error: "CAPTCHA_FAILED",
      message: "No pudimos confirmar que no eres un robot. Recarga la página e intenta de nuevo.",
    });
  }
  if (result === "unavailable") {
    console.warn("[turnstile] no se pudo verificar el captcha; se deja pasar el registro");
  }
  if (req.body && typeof req.body === "object") delete req.body.turnstileToken;
  return next();
}
