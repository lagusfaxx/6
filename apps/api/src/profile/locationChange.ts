import { Router } from "express";

import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";
import { geocodeAddress } from "../auth/registerHelpers";

/**
 * Cambio de ubicación de las profesionales.
 *
 * La comuna es lo que sale en la ficha y lo que ordena los listados por zona:
 * cuando una profesional la cambia por su cuenta (a otra ciudad, o a una
 * dirección en otro país) el anuncio aparece donde no atiende y ensucia los
 * resultados. Por eso la ubicación queda bloqueada una vez fijada y cualquier
 * cambio pasa por una solicitud que el admin aprueba o rechaza — que también
 * cubre la mudanza legítima. Ocultar el perfil o pedir la eliminación de la
 * cuenta siguen abiertos: este bloqueo no retiene a nadie en la app.
 */

export const locationChangeRouter = Router();

const MAX_REASON_LENGTH = 500;
const MIN_ADDRESS_LENGTH = 6;

/** Una profesional tiene la ubicación fijada si ya tiene dirección o comuna. */
export function hasLockedLocation(user: {
  profileType?: string | null;
  address?: string | null;
  city?: string | null;
}): boolean {
  return (
    user.profileType === "PROFESSIONAL" &&
    Boolean(String(user.address ?? "").trim() || String(user.city ?? "").trim())
  );
}

const normText = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/* ~11 m: el mismo punto vuelto a guardar puede llegar con otro redondeo. */
const COORD_EPSILON = 0.0001;

function sameCoord(next: unknown, current: number | null | undefined): boolean {
  if (next === undefined || next === null || next === "") return true;
  const n = Number(next);
  if (!Number.isFinite(n)) return true;
  if (current === null || current === undefined) return false;
  return Math.abs(n - current) < COORD_EPSILON;
}

/**
 * ¿El guardado del perfil cambia la ubicación? Sólo cuenta lo que viene en el
 * body: el panel reenvía la misma dirección en cada guardado y eso no es un
 * cambio.
 */
export function locationChanged(
  next: { address?: unknown; city?: unknown; latitude?: unknown; longitude?: unknown },
  current: {
    address?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
): boolean {
  if (next.address !== undefined && next.address !== null && normText(next.address) !== normText(current.address)) {
    return true;
  }
  if (next.city !== undefined && next.city !== null && normText(next.city) !== normText(current.city)) {
    return true;
  }
  return !sameCoord(next.latitude, current.latitude) || !sameCoord(next.longitude, current.longitude);
}

const requestSelect = {
  id: true,
  currentAddress: true,
  currentCity: true,
  requestedAddress: true,
  requestedCity: true,
  requestedLatitude: true,
  requestedLongitude: true,
  reason: true,
  status: true,
  adminNote: true,
  createdAt: true,
  reviewedAt: true,
} as const;

/* ── Profesional ─────────────────────────────────────────────── */

/** Su ubicación actual y el estado de su última solicitud. */
locationChangeRouter.get(
  "/profile/location-change",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { address: true, city: true, latitude: true, longitude: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const request = await prisma.locationChangeRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: requestSelect,
    });

    return res.json({
      address: user.address,
      city: user.city,
      latitude: user.latitude,
      longitude: user.longitude,
      // Sólo las profesionales tienen la ubicación bloqueada; locales y
      // tiendas la editan como cualquier otro dato.
      locked: hasLockedLocation(user),
      request,
    });
  }),
);

/** Pedir el cambio. Una solicitud pendiente a la vez. */
locationChangeRouter.post(
  "/profile/location-change",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const { address, city, latitude, longitude, reason } = (req.body ?? {}) as Record<string, any>;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        profileType: true,
        displayName: true,
        username: true,
      },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    if (user.profileType !== "PROFESSIONAL") {
      return res.status(403).json({
        error: "NOT_PROFESSIONAL",
        message: "Solo los perfiles profesionales usan este flujo.",
      });
    }

    const requestedAddress = String(address ?? "").trim();
    if (requestedAddress.length < MIN_ADDRESS_LENGTH) {
      return res.status(400).json({
        error: "ADDRESS_REQUIRED",
        message: "Busca y selecciona la nueva dirección en el buscador.",
      });
    }

    // Igual que en el registro: la dirección tiene que existir en el mapa.
    let requestedLatitude = Number(latitude);
    let requestedLongitude = Number(longitude);
    let requestedCity = typeof city === "string" && city.trim() ? city.trim() : null;
    if (!Number.isFinite(requestedLatitude) || !Number.isFinite(requestedLongitude)) {
      const geocoded = await geocodeAddress(requestedAddress);
      if (!geocoded || !Number.isFinite(geocoded.latitude) || !Number.isFinite(geocoded.longitude)) {
        return res.status(400).json({
          error: "ADDRESS_NOT_VERIFIED",
          message: "Debes validar la dirección usando el buscador del mapa.",
        });
      }
      requestedLatitude = geocoded.latitude;
      requestedLongitude = geocoded.longitude;
      if (!requestedCity) requestedCity = geocoded.city || null;
    }

    if (
      !locationChanged(
        { address: requestedAddress, city: requestedCity, latitude: requestedLatitude, longitude: requestedLongitude },
        user,
      )
    ) {
      return res.status(400).json({
        error: "LOCATION_UNCHANGED",
        message: "Esa ya es tu ubicación actual.",
      });
    }

    const pending = await prisma.locationChangeRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true, requestedCity: true, requestedAddress: true },
    });
    if (pending) {
      return res.status(409).json({
        error: "REQUEST_PENDING",
        message: `Ya tienes una solicitud en revisión para ${pending.requestedCity || pending.requestedAddress}.`,
      });
    }

    const created = await prisma.locationChangeRequest.create({
      data: {
        userId,
        currentAddress: user.address,
        currentCity: user.city,
        currentLatitude: user.latitude,
        currentLongitude: user.longitude,
        requestedAddress,
        requestedCity,
        requestedLatitude,
        requestedLongitude,
        reason: reason ? String(reason).trim().slice(0, MAX_REASON_LENGTH) || null : null,
      },
      select: requestSelect,
    });

    await emitAdminEvent({
      type: "location_change_requested",
      user: user.displayName || user.username,
      targetId: created.id,
    }).catch((err) => {
      console.error("[locationChange] admin event failed:", (err as Error)?.message);
    });

    return res.status(201).json({ request: created });
  }),
);

/** Retirar la solicitud mientras nadie la haya revisado. */
locationChangeRouter.post(
  "/profile/location-change/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const updated = await prisma.locationChangeRequest.updateMany({
      where: { id: req.params.id, userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ ok: true });
  }),
);

/* ── Admin ───────────────────────────────────────────────────── */

locationChangeRouter.use("/admin/location-changes", requireAdmin);

locationChangeRouter.get(
  "/admin/location-changes",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "PENDING").toUpperCase();
    const where: any = {};
    if (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const [requests, pendingCount] = await Promise.all([
      prisma.locationChangeRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          ...requestSelect,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              city: true,
              isVerified: true,
              isActive: true,
              createdAt: true,
            },
          },
          reviewer: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.locationChangeRequest.count({ where: { status: "PENDING" } }),
    ]);

    return res.json({ requests, pendingCount });
  }),
);

locationChangeRouter.post(
  "/admin/location-changes/:id/approve",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const request = await prisma.locationChangeRequest.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        requestedAddress: true,
        requestedCity: true,
        requestedLatitude: true,
        requestedLongitude: true,
        status: true,
      },
    });
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: "ALREADY_REVIEWED", message: "La solicitud ya fue revisada." });
    }

    const note = req.body?.note ? String(req.body.note).trim().slice(0, MAX_REASON_LENGTH) : null;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: request.userId },
        data: {
          address: request.requestedAddress,
          city: request.requestedCity,
          latitude: request.requestedLatitude,
          longitude: request.requestedLongitude,
        },
      }),
      prisma.locationChangeRequest.update({
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
          type: "LOCATION_CHANGE_REVIEWED",
          data: {
            title: "Cambio de ubicación aprobado",
            body: request.requestedCity
              ? `Tu perfil ahora aparece en ${request.requestedCity}.`
              : "Tu perfil ya muestra la nueva ubicación.",
            url: "/dashboard/services",
            status: "APPROVED",
          },
        },
      })
      .catch((err) => console.error("[locationChange] notify failed:", (err as Error)?.message));

    return res.json({ ok: true });
  }),
);

locationChangeRouter.post(
  "/admin/location-changes/:id/reject",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const note = req.body?.note ? String(req.body.note).trim().slice(0, MAX_REASON_LENGTH) : null;

    const request = await prisma.locationChangeRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ error: "ALREADY_REVIEWED", message: "La solicitud ya fue revisada." });
    }

    await prisma.locationChangeRequest.update({
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
          type: "LOCATION_CHANGE_REVIEWED",
          data: {
            title: "Cambio de ubicación rechazado",
            body: note || "Escríbenos si necesitas revisarlo de nuevo.",
            url: "/dashboard/services",
            status: "REJECTED",
          },
        },
      })
      .catch((err) => console.error("[locationChange] notify failed:", (err as Error)?.message));

    return res.json({ ok: true });
  }),
);
