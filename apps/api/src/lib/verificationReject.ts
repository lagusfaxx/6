import { prisma } from "../db";
import { sendVerificationRejectedEmail } from "./notificationEmail";

export const REJECT_REASON_MIN_LENGTH = 5;
export const REJECT_REASON_MAX_LENGTH = 1000;

/**
 * Rechaza la verificación de un perfil: queda oculto, sale de la cola de
 * pendientes y la profesional recibe el motivo por correo. Si corrige su ficha
 * o sube fotos vuelve a la cola sola (ver el middleware de `db.ts`).
 */
export async function rejectVerification(userId: string, reason: string) {
  const text = reason.trim().slice(0, REJECT_REASON_MAX_LENGTH);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      verificationRejectedAt: new Date(),
      verificationRejectReason: text,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      isVerified: true,
      isActive: true,
      verificationRejectedAt: true,
      verificationRejectReason: true,
    },
  });

  let emailSent = false;
  if (updated.email) {
    await sendVerificationRejectedEmail(updated.email, updated.displayName, text);
    emailSent = true;
  }
  return { profile: updated, emailSent };
}
