import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";

/**
 * Token de baja para los correos de aviso.
 *
 * El enlace viaja dentro del correo, así que tiene que funcionar sin sesión:
 * quien lo abre puede estar en otro dispositivo o no haber iniciado sesión.
 * Se firma el id de usuario con HMAC sobre SESSION_SECRET para que nadie
 * pueda dar de baja a un tercero probando ids.
 *
 * No caduca a propósito: un enlace de baja que expira obliga al usuario a
 * marcar el correo como spam, que es peor para la reputación del dominio.
 */

const PURPOSE = "email-prefs:v1";

export function signEmailPrefsToken(userId: string): string {
  return createHmac("sha256", config.sessionSecret)
    .update(`${PURPOSE}:${userId}`)
    .digest("base64url");
}

export function verifyEmailPrefsToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = Buffer.from(signEmailPrefsToken(userId));
  const received = Buffer.from(String(token));
  // timingSafeEqual exige igual longitud; distinta longitud ya es un fallo.
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** URL de baja que se incrusta en cada correo de aviso. */
export function buildUnsubscribeUrl(userId: string): string {
  const token = signEmailPrefsToken(userId);
  return `${config.appUrl}/cuenta/notificaciones/baja?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}
