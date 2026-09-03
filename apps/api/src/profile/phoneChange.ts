import { Router } from "express";

import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";

/**
 * Cambio de teléfono de las profesionales.
 *
 * El número de WhatsApp es la vía de contacto del anuncio: cuando una
 * profesional lo cambia por su cuenta, la cuenta anterior queda publicada con
 * un número que ya no responde y ensucia la app. Por eso el número queda
 * bloqueado una vez fijado y cualquier cambio pasa por una solicitud que el
 * admin aprueba o rechaza — que también cubre el caso legítimo de haberse
 * equivocado al registrarse.
 */

export const phoneChangeRouter = Router();

export const PROFESSIONAL_PHONE_REGEX =
  /^\+(?:56\s?9(?:[\s-]?\d){8}|57\s?3(?:[\s-]?\d){9}|58\s?4(?:[\s-]?\d){9}|51\s?9(?:[\s-]?\d){8})$/;

/** Dos números son el mismo aunque estén escritos con distintos espacios. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => String(v ?? "").replace(/[\s-]/g, "");
  return norm(a) === norm(b);
}

const MAX_REASON_LENGTH = 500;

/* ── Profesional ─────────────────────────────────────────────── */

/** Su número actual y el estado de su última solicitud. */
phoneChangeRouter.get(
  "/profile/phone-change",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const request = await prisma.phoneChangeRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestedPhone: true,
        currentPhone: true,
        reason: true,
        status: true,
        adminNote: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    return res.json({
      phone: user.phone,
      // Sólo las profesionales tienen el número bloqueado; el resto lo edita
      // como cualquier otro dato.
      locked: user.profileType === "PROFESSIONAL" && Boolean(user.phone),
      request,
    });
  }),
);

/** Pedir el cambio. Una solicitud pendiente a la vez. */
phoneChangeRouter.post(
  "/profile/phone-change",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const { phone, reason } = (req.body ?? {}) as { phone?: string; reason?: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, profileType: true, displayName: true, username: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    if (user.profileType !== "PROFESSIONAL") {
      return res.status(403).json({
        error: "NOT_PROFESSIONAL",
        message: "Solo los perfiles profesionales usan este flujo.",
      });
    }

    const requestedPhone = String(phone ?? "").trim();
    if (!PROFESSIONAL_PHONE_REGEX.test(requestedPhone)) {
      return res.status(400).json({
        error: "PHONE_INVALID",
        message: "Ingresa un número válido con código de país (+56, +57, +58 o +51).",
      });
    }
    if (samePhone(requestedPhone, user.phone)) {
      return res.status(400).json({
        error: "PHONE_UNCHANGED",
        message: "Ese ya es tu número actual.",
      });
    }

    const taken = await prisma.user.findFirst({
      where: { phone: requestedPhone, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      return res.status(409).json({
        error: "PHONE_TAKEN",
        message: "Ese número ya está registrado en otra cuenta.",
      });
    }

    const pending = await prisma.phoneChangeRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true, requestedPhone: true },
    });
    if (pending) {
      return res.status(409).json({
        error: "REQUEST_PENDING",
        message: `Ya tienes una solicitud en revisión para el ${pending.requestedPhone}.`,
      });
    }

    const created = await prisma.phoneChangeRequest.create({
      data: {
        userId,
        currentPhone: user.phone,
        requestedPhone,
        reason: reason ? String(reason).trim().slice(0, MAX_REASON_LENGTH) || null : null,
      },
      select: {
        id: true,
        requestedPhone: true,
        currentPhone: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    await emitAdminEvent({
      type: "phone_change_requested",
      user: user.displayName || user.username,
      targetId: created.id,
    }).catch((err) => {
      console.error("[phoneChange] admin event failed:", (err as Error)?.message);
    });

    return res.status(201).json({ request: created });
  }),
);

/** Retirar la solicitud mientras nadie la haya revisado. */
phoneChangeRouter.post(
  "/profile/phone-change/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const updated = await prisma.phoneChangeRequest.updateMany({
      where: { id: req.params.id, userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ ok: true });
  }),
);

/* ── Admin ───────────────────────────────────────────────────── */

phoneChangeRouter.use("/admin/phone-changes", requireAdmin);

phoneChangeRouter.get(
  "/admin/phone-changes",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "PENDING").toUpperCase();
    const where: any = {};
    if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const [requests, pendingCount] = await Promise.all([
      prisma.phoneChangeRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          currentPhone: true,
          requestedPhone: true,
          reason: true,
          status: true,
          adminNote: true,
          createdAt: true,
          reviewedAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              city: true,
              phone: true,
              isVerified: true,
              isActive: true,
              createdAt: true,
            },
          },
          reviewer: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.phoneChangeRequest.count({ where: { status: "PENDING" } }),
    ]);

    return res.json({ requests, pendingCount });
  }),
);

phoneChangeRouter.post(
  "/admin/phone-changes/:id/approve",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const request = await prisma.phoneChangeRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, requestedPhone: true, status: true },
    });
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: "ALREADY_REVIEWED", message: "La solicitud ya fue revisada." });
    }

    // Entre la solicitud y la aprobación el número puede haberse ocupado.
    const taken = await prisma.user.findFirst({
      where: { phone: request.requestedPhone, NOT: { id: request.userId } },
      select: { id: true, username: true },
    });
    if (taken) {
      return res.status(409).json({
        error: "PHONE_TAKEN",
        message: `Ese número ya está en la cuenta @${taken.username}.`,
      });
    }

    const note = req.body?.note ? String(req.body.note).trim().slice(0, MAX_REASON_LENGTH) : null;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.userId },
        data: { phone: request.requestedPhone },
      }),
      prisma.phoneChangeRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminNote: note,
        },
      }),
    ]);

    await prisma.notification
      .create({
        data: {
          userId: request.userId,
          type: "PHONE_CHANGE_REVIEWED",
          data: {
            title: "Cambio de número aprobado",
            body: `Tu perfil ahora muestra el ${request.requestedPhone}.`,
            url: "/cuenta/perfil",
            status: "APPROVED",
            phone: request.requestedPhone,
          },
        },
      })
      .catch((err) => console.error("[phoneChange] notify failed:", (err as Error)?.message));

    return res.json({ ok: true, phone: request.requestedPhone });
  }),
);

phoneChangeRouter.post(
  "/admin/phone-changes/:id/reject",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, MAX_REASON_LENGTH) : null;

    const request = await prisma.phoneChangeRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: "ALREADY_REVIEWED", message: "La solicitud ya fue revisada." });
    }

    await prisma.phoneChangeRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        adminNote: note,
      },
    });

    await prisma.notification
      .create({
        data: {
          userId: request.userId,
          type: "PHONE_CHANGE_REVIEWED",
          data: {
            title: "Cambio de número rechazado",
            body: note || "Escríbenos si necesitas revisarlo de nuevo.",
            url: "/cuenta/perfil",
            status: "REJECTED",
          },
        },
      })
      .catch((err) => console.error("[phoneChange] notify failed:", (err as Error)?.message));

    return res.json({ ok: true });
  }),
);
