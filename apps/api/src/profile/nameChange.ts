import { Router } from "express";

import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";

/**
 * Cambio de nombre público de las profesionales.
 *
 * El nombre es con lo que se reconoce el anuncio: quien la tenía guardada, la
 * vio en una captura o la recomendó, la busca por ese nombre. Cambiarlo por
 * cuenta propia rompe todo eso y además es la vía fácil para reciclar una
 * cuenta sancionada, así que el nombre queda fijo una vez puesto y cualquier
 * cambio pasa por una solicitud que el admin aprueba o rechaza — que también
 * cubre el caso legítimo de haberse equivocado al registrarse.
 */

export const nameChangeRouter = Router();

/** Tope de largo del nombre público, compartido con el registro. */
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MIN_LENGTH = 2;

/**
 * Un nombre demasiado largo rompe las tarjetas del inicio y los listados, que
 * es donde se decide el contacto. También se limpian los espacios repetidos
 * para que "Ana   María" y "Ana María" no sean nombres distintos.
 */
export function normalizeDisplayName(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

export function displayNameError(name: string): string | null {
  if (name.length < DISPLAY_NAME_MIN_LENGTH) {
    return `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`;
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `El nombre no puede superar los ${DISPLAY_NAME_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/** Dos nombres son el mismo salvo espacios y mayúsculas. */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeDisplayName(a).toLowerCase() === normalizeDisplayName(b).toLowerCase();
}

const MAX_REASON_LENGTH = 500;

/* ── Profesional ─────────────────────────────────────────────── */

/** Su nombre actual y el estado de su última solicitud. */
nameChangeRouter.get(
  "/profile/name-change",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const request = await prisma.nameChangeRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestedName: true,
        currentName: true,
        reason: true,
        status: true,
        adminNote: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    return res.json({
      displayName: user.displayName,
      // Sólo las profesionales tienen el nombre bloqueado; el resto lo edita
      // como cualquier otro dato.
      locked: user.profileType === "PROFESSIONAL" && Boolean(user.displayName),
      maxLength: DISPLAY_NAME_MAX_LENGTH,
      request,
    });
  }),
);

/** Pedir el cambio. Una solicitud pendiente a la vez. */
nameChangeRouter.post(
  "/profile/name-change",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const { displayName, reason } = (req.body ?? {}) as {
      displayName?: string;
      reason?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, profileType: true, username: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    if (user.profileType !== "PROFESSIONAL") {
      return res.status(403).json({
        error: "NOT_PROFESSIONAL",
        message: "Solo los perfiles profesionales usan este flujo.",
      });
    }

    const requestedName = normalizeDisplayName(displayName);
    const invalid = displayNameError(requestedName);
    if (invalid) {
      return res.status(400).json({ error: "NAME_INVALID", message: invalid });
    }
    if (sameName(requestedName, user.displayName)) {
      return res.status(400).json({
        error: "NAME_UNCHANGED",
        message: "Ese ya es tu nombre actual.",
      });
    }

    const pending = await prisma.nameChangeRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true, requestedName: true },
    });
    if (pending) {
      return res.status(409).json({
        error: "REQUEST_PENDING",
        message: `Ya tienes una solicitud en revisión para "${pending.requestedName}".`,
      });
    }

    const created = await prisma.nameChangeRequest.create({
      data: {
        userId,
        currentName: user.displayName,
        requestedName,
        reason: reason ? String(reason).trim().slice(0, MAX_REASON_LENGTH) || null : null,
      },
      select: {
        id: true,
        requestedName: true,
        currentName: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    await emitAdminEvent({
      type: "name_change_requested",
      user: user.displayName || user.username,
      targetId: created.id,
    }).catch((err) => {
      console.error("[nameChange] admin event failed:", (err as Error)?.message);
    });

    return res.status(201).json({ request: created });
  }),
);

/** Retirar la solicitud mientras nadie la haya revisado. */
nameChangeRouter.post(
  "/profile/name-change/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const updated = await prisma.nameChangeRequest.updateMany({
      where: { id: req.params.id, userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ ok: true });
  }),
);

/* ── Admin ───────────────────────────────────────────────────── */

nameChangeRouter.use("/admin/name-changes", requireAdmin);

nameChangeRouter.get(
  "/admin/name-changes",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "PENDING").toUpperCase();
    const where: any = {};
    if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const [requests, pendingCount] = await Promise.all([
      prisma.nameChangeRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          currentName: true,
          requestedName: true,
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
      prisma.nameChangeRequest.count({ where: { status: "PENDING" } }),
    ]);

    return res.json({ requests, pendingCount });
  }),
);

nameChangeRouter.post(
  "/admin/name-changes/:id/approve",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const request = await prisma.nameChangeRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, requestedName: true, status: true },
    });
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: "ALREADY_REVIEWED", message: "La solicitud ya fue revisada." });
    }

    const note = req.body?.note ? String(req.body.note).trim().slice(0, MAX_REASON_LENGTH) : null;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.userId },
        data: { displayName: request.requestedName },
      }),
      prisma.nameChangeRequest.update({
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
          type: "NAME_CHANGE_REVIEWED",
          data: {
            title: "Cambio de nombre aprobado",
            body: `Tu perfil ahora se muestra como ${request.requestedName}.`,
            url: "/cuenta/perfil",
            status: "APPROVED",
            displayName: request.requestedName,
          },
        },
      })
      .catch((err) => console.error("[nameChange] notify failed:", (err as Error)?.message));

    return res.json({ ok: true, displayName: request.requestedName });
  }),
);

nameChangeRouter.post(
  "/admin/name-changes/:id/reject",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, MAX_REASON_LENGTH) : null;

    const request = await prisma.nameChangeRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: "ALREADY_REVIEWED", message: "La solicitud ya fue revisada." });
    }

    await prisma.nameChangeRequest.update({
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
          type: "NAME_CHANGE_REVIEWED",
          data: {
            title: "Cambio de nombre rechazado",
            body: note || "Escríbenos si necesitas revisarlo de nuevo.",
            url: "/cuenta/perfil",
            status: "REJECTED",
          },
        },
      })
      .catch((err) => console.error("[nameChange] notify failed:", (err as Error)?.message));

    return res.json({ ok: true });
  }),
);
