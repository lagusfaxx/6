import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const photoPermissionRouter = Router();

/**
 * ¿Puede `senderId` mandarle una foto a `recipientId`?
 *
 * Solo las profesionales tienen este interruptor, y empieza apagado: recibir
 * fotos de desconocidos es algo que se pide, no algo que se soporta. Sus
 * propios envíos no se tocan (una profesional siempre puede mandar fotos a un
 * cliente).
 */
export async function canSendPhoto(recipientId: string): Promise<boolean> {
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { profileType: true, allowChatPhotos: true },
  });
  if (!recipient) return false;
  if (recipient.profileType !== "PROFESSIONAL") return true;
  return recipient.allowChatPhotos;
}

photoPermissionRouter.get(
  "/messages/photo-permission",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { allowChatPhotos: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    return res.json({
      allowChatPhotos: user.allowChatPhotos,
      available: user.profileType === "PROFESSIONAL",
    });
  }),
);

photoPermissionRouter.patch(
  "/messages/photo-permission",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const value = req.body?.allowChatPhotos;
    if (typeof value !== "boolean") {
      return res.status(400).json({ error: "INVALID_VALUE" });
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { allowChatPhotos: value },
      select: { allowChatPhotos: true },
    });
    return res.json({ allowChatPhotos: user.allowChatPhotos });
  }),
);
