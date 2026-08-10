import type { ProfileType } from "@prisma/client";

/**
 * Quién puede recibir avisos por correo de mensajes.
 *
 * REGLA DE SEGURIDAD, no una preferencia de producto: mucha gente se registra
 * como cliente justamente para estar de incógnito. Un correo de UZEED que
 * aterriza en su bandeja —o que asoma en una notificación de escritorio, o
 * que ve quien comparte el equipo— lo expone. Por eso los avisos salen solo
 * hacia perfiles publicados, que son públicos por definición.
 *
 * Se comprueba contra el profileType actual y no contra una marca guardada:
 * un cliente puede pasar a profesional más adelante, y al revés. Consultar el
 * tipo en el momento del envío evita que una marca vieja quede desalineada.
 *
 * Si algún día se suman ESTABLISHMENT o SHOP (moteles, sexshops: negocios con
 * correo de negocio, sin riesgo de exposición personal), se agregan aquí y
 * queda cubierto tanto el envío como la interfaz.
 */
export const EMAIL_NOTIFIABLE_PROFILE_TYPES = ["PROFESSIONAL"] as const;

export function canReceiveMessageEmails(profileType: ProfileType | string | null | undefined): boolean {
  if (!profileType) return false;
  return (EMAIL_NOTIFIABLE_PROFILE_TYPES as readonly string[]).includes(String(profileType));
}
