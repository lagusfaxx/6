import argon2 from "argon2";
import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { invalidateUserCache } from "../auth/userCache";
import { asyncHandler } from "../lib/asyncHandler";

/**
 * POST /profile/delete-account — la profesional elimina su cuenta desde
 * /cuenta. Sin un motivo de al menos DELETE_REASON_MIN caracteres no se
 * elimina nada; si la cuenta tiene contraseña, también hay que escribirla.
 *
 * No es un borrado en cascada como el del admin: los pedidos y pagos tienen
 * que seguir existiendo, y el cliente no debería perder su historial de chat.
 * Se borra lo personal (correo, teléfono, nombre, fotos, ubicación, fecha de
 * nacimiento), el perfil sale del sitio y no se puede volver a entrar. El
 * motivo queda en AccountDeletion para el equipo.
 */
export const DELETE_REASON_MIN = 30;

/* Pedidos del marketplace que todavía no se cierran: con plata o entregas
   pendientes no se puede desaparecer. */
const OPEN_ORDER_STATUSES = ["PAYMENT_REVIEW", "PAID", "PREPARING", "DELIVERED", "DISPUTED"] as const;

export const deleteAccountRouter = Router();

/* Lo que necesita el formulario: si pide contraseña (las cuentas de Google no
   tienen) y el largo mínimo del motivo. */
deleteAccountRouter.get(
  "/profile/delete-account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { passwordHash: true },
    });
    return res.json({ hasPassword: Boolean(user?.passwordHash), reasonMin: DELETE_REASON_MIN });
  }),
);

deleteAccountRouter.post(
  "/profile/delete-account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().replace(/\s+/g, " ") : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    /* El motivo tiene que ser texto de verdad, no "aaaaaaaa…". */
    const distinctChars = new Set(reason.toLowerCase().replace(/[^a-záéíóúñü]/g, "")).size;
    if (reason.length < DELETE_REASON_MIN || distinctChars < 6) {
      return res.status(400).json({
        error: "REASON_REQUIRED",
        message: `Cuéntanos el motivo con al menos ${DELETE_REASON_MIN} caracteres para poder eliminar tu cuenta.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, profileType: true, passwordHash: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return res.status(404).json({ error: "NOT_FOUND" });
    if (user.profileType !== "PROFESSIONAL") {
      return res.status(403).json({ error: "NOT_PROFESSIONAL", message: "Esta opción es para perfiles profesionales." });
    }

    if (user.passwordHash) {
      const ok = password ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
      if (!ok) {
        return res.status(400).json({ error: "PASSWORD_INVALID", message: "La contraseña no es correcta." });
      }
    }

    const openOrders = await prisma.marketOrder.count({
      where: { sellerId: userId, status: { in: [...OPEN_ORDER_STATUSES] } },
    });
    if (openOrders > 0) {
      return res.status(409).json({
        error: "OPEN_ORDERS",
        message: "Tienes ventas en curso. Termínalas (o escríbenos) antes de eliminar tu cuenta.",
      });
    }

    const tag = crypto.randomBytes(4).toString("hex");
    await prisma.$transaction(async (tx) => {
      await tx.accountDeletion.create({
        data: {
          userId,
          username: user.username,
          displayName: user.displayName,
          profileType: user.profileType,
          reason: reason.slice(0, 2000),
        },
      });
      await tx.story.deleteMany({ where: { userId } });
      await tx.profileMedia.deleteMany({ where: { ownerId: userId } });
      await tx.serviceItem.deleteMany({ where: { ownerId: userId } });
      await tx.favorite.deleteMany({ where: { OR: [{ userId }, { professionalId: userId }] } });
      await tx.pushSubscription.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.marketProduct.updateMany({ where: { userId }, data: { isActive: false } });
      await tx.marketSeller.updateMany({ where: { userId }, data: { isActive: false } });
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          isActive: false,
          isVerified: false,
          isOnline: false,
          email: `eliminada-${tag}-${userId}@deleted.uzeed.cl`,
          username: `eliminada-${tag}`,
          displayName: "Cuenta eliminada",
          passwordHash: null,
          phone: null,
          bio: null,
          avatarUrl: null,
          coverUrl: null,
          address: null,
          city: null,
          latitude: null,
          longitude: null,
          birthdate: null,
          serviceDescription: null,
          profileTags: [],
          serviceTags: [],
          quickReplies: undefined,
          autoReplyEnabled: false,
          autoReplyMessage: null,
          emailOnNewMessage: false,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          passwordSetToken: null,
        },
      });
    });

    invalidateUserCache(userId);

    req.session.destroy(() => {
      res.clearCookie("uzeed_session");
      return res.json({ ok: true });
    });
  }),
);
