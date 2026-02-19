import { Router } from "express";
import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../auth/middleware";
import { isBusinessPlanActive } from "../lib/subscriptions";
import multer from "multer";
import path from "path";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { validateUploadedFile } from "../lib/uploads";
import { asyncHandler } from "../lib/asyncHandler";
import { findCategoryByRef } from "../lib/categories";
import { obfuscateLocation } from "../lib/locationPrivacy";
import { isUUID } from "../lib/validators";
import { sendToUser } from "../realtime/sse";
import { resolveProfessionalLevel } from "../lib/professionalLevel";

export const servicesRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`,
});
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const name = `${Date.now()}-${safeBase}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

async function ensureUserCategory(
  userId: string,
  categoryId: string | null,
  displayName: string | null,
  currentCategoryId: string | null,
) {
  if (!categoryId && !displayName) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      serviceCategory: displayName ?? undefined,
      categoryId: categoryId || currentCategoryId || null,
    },
  });
}

async function createServiceNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any>,
) {
  await prisma.notification.create({
    data: {
      userId,
      type: "SERVICE_PUBLISHED",
      data: { title, body, ...data },
    },
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const AVAILABLE_WINDOW_MS = 10 * 60 * 1000;
const QUICK_REVIEW_TAGS = ["#Puntual", "#IgualALaFoto", "#Discrecion"] as const;

function normalizeLegacyCategory(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isSpaceCategory(value: string | null | undefined) {
  const normalized = normalizeLegacyCategory(value);
  return normalized.includes("motel") || normalized.includes("hotel");
}

function computeAvailableNow(lastSeen: Date | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= AVAILABLE_WINDOW_MS;
}

function computeAge(birthdate: Date | null | undefined) {
  if (!birthdate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const monthDiff = now.getMonth() - birthdate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthdate.getDate())
  ) {
    age -= 1;
  }
  return age >= 18 ? age : null;
}

servicesRouter.get(
  "/services",
  asyncHandler(async (req, res) => {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim().toLowerCase().replace(/-/g, " ") : "";
    const services = typeof req.query.services === "string" ? req.query.services.trim().toLowerCase() : "";
    const genderFilter = typeof req.query.gender === "string" ? req.query.gender.trim().toLowerCase() : "";
    const regionFilter = typeof req.query.region === "string" ? req.query.region.trim().toLowerCase() : "";
    const rangeKm = req.query.rangeKm
      ? Math.max(1, Math.min(200, Number(req.query.rangeKm)))
      : null;
    const types =
      typeof req.query.types === "string"
        ? req.query.types.split(",").map((t) => t.trim())
        : [];
    const profiles = await prisma.user.findMany({
      where: {
        profileType: {
          in: types.length ? types : ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"],
        },
        ...(q
          ? {
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
                { serviceCategory: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        city: true,
        latitude: true,
        longitude: true,
        serviceCategory: true,
        serviceDescription: true,
        categoryLabel: true,
        servicesTags: true,
        genderIdentity: true,
        region: true,
        comuna: true,
        profileType: true,
        isActive: true,
        isOnline: true,
        birthdate: true,
        heightCm: true,
        hairColor: true,
        weightKg: true,
        baseRate: true,
        lastSeen: true,
        completedServices: true,
        membershipExpiresAt: true,
        shopTrialEndsAt: true,
      },
    });

    const enriched = profiles
      .filter((p) => isBusinessPlanActive(p))
      .map((p) => {
        const distance =
          lat !== null &&
          lng !== null &&
          p.latitude !== null &&
          p.longitude !== null
            ? haversine(lat, lng, p.latitude, p.longitude)
            : null;
        const obfuscated = obfuscateLocation(
          p.latitude,
          p.longitude,
          `services:${p.id}`,
          500,
        );
        return {
          ...p,
          realLatitude: p.latitude,
          realLongitude: p.longitude,
          latitude: obfuscated.latitude,
          longitude: obfuscated.longitude,
          locality: p.city || null,
          distance,
          availableNow: Boolean(p.isOnline) && computeAvailableNow(p.lastSeen),
          age: computeAge(p.birthdate),
          heightCm: p.heightCm,
          hairColor: p.hairColor,
          weightKg: p.weightKg,
          baseRate: p.baseRate,
          lastSeen: p.lastSeen ? p.lastSeen.toISOString() : null,
          userLevel: resolveProfessionalLevel(p.completedServices),
        };
      });

    const filteredBase = enriched.filter((p) => {
      const haystack = `${p.serviceCategory || ""} ${p.serviceDescription || ""} ${p.categoryLabel || ""}`.toLowerCase();
      const tagText = Array.isArray((p as any).servicesTags) ? (p as any).servicesTags.join(" ").toLowerCase() : "";
      const locationText = `${p.city || ""} ${(p as any).region || ""} ${(p as any).comuna || ""}`.toLowerCase();
      const genderText = `${(p as any).genderIdentity || ""}`.toLowerCase();

      if (category && !(haystack.includes(category) || tagText.includes(category))) return false;
      if (services) {
        const tokens = services.split(",").map((x) => x.trim()).filter(Boolean);
        const ok = tokens.every((t) => haystack.includes(t) || tagText.includes(t));
        if (!ok) return false;
      }
      if (genderFilter && !genderText.includes(genderFilter)) return false;
      if (regionFilter && !locationText.includes(regionFilter)) return false;
      if (rangeKm != null && p.distance != null ? p.distance > rangeKm : false) return false;
      return true;
    });

    const sorted = filteredBase
      .sort((a, b) => {
        if (a.availableNow !== b.availableNow) {
          return Number(b.availableNow) - Number(a.availableNow);
        }
        const lastSeenDiff =
          (Date.parse(b.lastSeen || "") || 0) -
          (Date.parse(a.lastSeen || "") || 0);
        if (lastSeenDiff !== 0) return lastSeenDiff;
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

    return res.json({ profiles: sorted });
  }),
);

servicesRouter.get(
  "/map",
  asyncHandler(async (req, res) => {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const types =
      typeof req.query.types === "string"
        ? req.query.types.split(",").map((t) => t.trim())
        : [];
    const rangeKm = req.query.rangeKm
      ? Math.max(1, Math.min(200, Number(req.query.rangeKm)))
      : null;

    const profiles = await prisma.user.findMany({
      where: {
        profileType: {
          in: types.length ? types : ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"],
        },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileType: true,
        latitude: true,
        longitude: true,
        city: true,
        serviceCategory: true,
        membershipExpiresAt: true,
        shopTrialEndsAt: true,
      },
    });

    const enriched = profiles
      .filter((p) => isBusinessPlanActive(p))
      .map((p) => {
        const distance =
          lat !== null &&
          lng !== null &&
          p.latitude !== null &&
          p.longitude !== null
            ? haversine(lat, lng, p.latitude, p.longitude)
            : null;
        const obfuscated = obfuscateLocation(
          p.latitude,
          p.longitude,
          `map:${p.id}`,
          500,
        );
        return {
          ...p,
          realLatitude: p.latitude,
          realLongitude: p.longitude,
          latitude: obfuscated.latitude,
          longitude: obfuscated.longitude,
          locality: p.city || null,
          distance,
        };
      });

    return res.json({
      profiles: enriched.filter((p) =>
        rangeKm != null && p.distance != null ? p.distance <= rangeKm : true,
      ),
    });
  }),
);

// Global map/list: returns individual ServiceItem (not just profiles)
servicesRouter.get(
  "/services/global",
  asyncHandler(async (req, res) => {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const kind =
      typeof req.query.kind === "string" ? req.query.kind.trim() : "";
    const type =
      typeof req.query.type === "string"
        ? req.query.type.trim().toLowerCase()
        : "";
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const sort =
      typeof req.query.sort === "string" ? req.query.sort.trim() : "near";
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : null;
    const availableNow =
      req.query.availableNow === "1" || sort === "availableNow";
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const limit = req.query.limit
      ? Math.min(Number(req.query.limit) || 80, 300)
      : 80;

    const ownerTypes = kind
      ? [kind]
      : ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"];

    const items = await prisma.serviceItem.findMany({
      where: {
        isActive: true,
        owner: {
          profileType: { in: ownerTypes as any },
        },
        ...(minPrice !== null ? { price: { gte: minPrice } } : {}),
        ...(maxPrice !== null ? { price: { lte: maxPrice } } : {}),
        ...(category
          ? {
              OR: [
                { categoryRel: { slug: category } },
                ...(isUUID(category)
                  ? [{ categoryRel: { id: category } }]
                  : []),
                { category: { contains: category, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            profileType: true,
            city: true,
            coverUrl: true,
            isOnline: true,
            lastSeen: true,
            membershipExpiresAt: true,
            shopTrialEndsAt: true,
          },
        },
        media: { select: { id: true, url: true, type: true } },
        categoryRel: {
          select: {
            id: true,
            slug: true,
            displayName: true,
            name: true,
            kind: true,
          },
        },
      },
    });

    const enriched = items
      .map((s) => {
        const distance =
          lat !== null &&
          lng !== null &&
          s.latitude !== null &&
          s.longitude !== null
            ? haversine(lat, lng, s.latitude, s.longitude)
            : null;

        const radius = s.approxAreaM ?? 600;

        const ownerAvailableNow = computeAvailableNow(s.owner?.lastSeen);
        const resolvedCategory = s.categoryRel
          ? s.categoryRel.displayName || s.categoryRel.name
          : s.category;

        return {
          id: s.id,
          title: s.title,
          description: s.description,
          price: s.price,
          category: resolvedCategory,
          categorySlug: s.categoryRel?.slug ?? null,
          type: isSpaceCategory(resolvedCategory) ? "space" : "experience",
          address: s.address,
          latitude: s.latitude !== null ? Number(s.latitude) : null,
          longitude: s.longitude !== null ? Number(s.longitude) : null,
          coordinates:
            s.latitude !== null && s.longitude !== null
              ? { lat: Number(s.latitude), lng: Number(s.longitude) }
              : null,
          approxAreaM: radius,
          locationVerified: s.locationVerified,
          distance,
          availableNow: ownerAvailableNow,
          createdAt: s.createdAt,
          owner: s.owner,
          media: s.media,
        };
      })
      .filter((s) => {
        if (!type) return true;
        return type === "space"
          ? isSpaceCategory(s.category)
          : !isSpaceCategory(s.category);
      })
      .filter((s) =>
        radiusKm !== null && s.distance !== null
          ? s.distance <= radiusKm
          : true,
      );

    const filteredByAvailableNow = availableNow
      ? enriched.filter((s) => s.availableNow)
      : enriched;
    const fallbackToAll = availableNow && filteredByAvailableNow.length === 0;
    const filtered = fallbackToAll ? enriched : filteredByAvailableNow;

    if (sort === "new") {
      filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (sort === "near") {
      filtered.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
    } else if (sort === "availableNow") {
      filtered.sort(
        (a, b) =>
          Number(Boolean(b.availableNow)) - Number(Boolean(a.availableNow)),
      );
    }

    return res.json({ services: filtered });
  }),
);

servicesRouter.get(
  "/services/:userId/items",
  asyncHandler(async (req, res) => {
    const items = await prisma.serviceItem.findMany({
      where: { ownerId: req.params.userId },
      orderBy: { createdAt: "desc" },
      include: {
        media: true,
        categoryRel: {
          select: { id: true, slug: true, displayName: true, name: true },
        },
      },
    });
    return res.json({ items });
  }),
);

servicesRouter.post(
  "/services/items",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { id: true, profileType: true, categoryId: true },
    });
    if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!["SHOP", "PROFESSIONAL", "ESTABLISHMENT"].includes(me.profileType)) {
      return res.status(403).json({ error: "NOT_ALLOWED" });
    }
    const { title, description, price } = req.body as Record<string, string>;
    const addressLabel =
      typeof req.body?.addressLabel === "string"
        ? req.body.addressLabel
        : typeof req.body?.address === "string"
          ? req.body.address
          : null;
    // Nota: no persistimos `locality` (barrio/comuna) en ServiceItem.
    // El frontend puede enviarlo, pero el backend debe ignorarlo para no romper Prisma.
    const approxAreaM =
      req.body?.approxAreaM != null &&
      Number.isFinite(Number(req.body.approxAreaM))
        ? Math.max(200, Math.min(1200, Number(req.body.approxAreaM)))
        : null;
    const categoryId =
      typeof req.body?.categoryId === "string" ? req.body.categoryId : null;
    const categorySlug =
      typeof req.body?.categorySlug === "string" ? req.body.categorySlug : null;
    const categoryName =
      typeof req.body?.category === "string" ? req.body.category : null;
    const latitude =
      req.body?.latitude != null &&
      req.body?.latitude !== "" &&
      Number.isFinite(Number(req.body.latitude))
        ? Number(req.body.latitude)
        : null;
    const longitude =
      req.body?.longitude != null &&
      req.body?.longitude !== "" &&
      Number.isFinite(Number(req.body.longitude))
        ? Number(req.body.longitude)
        : null;
    const isActive =
      typeof req.body?.isActive === "boolean" ? req.body.isActive : true;
    const durationMinutes =
      req.body?.durationMinutes != null &&
      req.body?.durationMinutes !== "" &&
      Number.isFinite(Number(req.body.durationMinutes))
        ? Math.max(
            15,
            Math.min(600, Math.round(Number(req.body.durationMinutes))),
          )
        : null;
    const locationVerified = req.body?.locationVerified === true;
    if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });
    if (
      !locationVerified ||
      !addressLabel ||
      latitude == null ||
      longitude == null
    ) {
      return res.status(400).json({
        error: "LOCATION_NOT_VERIFIED",
        message: "Debes confirmar la dirección en el mapa antes de publicar.",
      });
    }

    const kind =
      me.profileType === "ESTABLISHMENT"
        ? "ESTABLISHMENT"
        : me.profileType === "SHOP"
          ? "SHOP"
          : "PROFESSIONAL";
    const category = await findCategoryByRef(prisma, {
      categoryId,
      categorySlug,
      categoryName,
      kind,
    });
    if (!category) {
      return res.status(400).json({
        error: "CATEGORY_INVALID",
        message:
          "La categoría seleccionada no existe. Actualiza la página e intenta nuevamente.",
      });
    }

    if (isActive) {
      await prisma.serviceItem.updateMany({
        where: { ownerId: me.id, isActive: true },
        data: { isActive: false },
      });
    }

    let item;
    try {
      item = await prisma.serviceItem.create({
        data: {
          ownerId: me.id,
          title,
          description,
          category: category.displayName || category.name,
          categoryId: category.id,
          price: price ? Number(price) : null,
          address: addressLabel || null,
          latitude,
          longitude,
          approxAreaM,
          locationVerified,
          isActive,
          durationMinutes,
        },
      });
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2022") ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        item = await prisma.serviceItem.create({
          data: {
            ownerId: me.id,
            title,
            description,
            category: category.displayName || category.name,
            categoryId: category.id,
            price: price ? Number(price) : null,
            address: addressLabel || null,
            latitude,
            longitude,
            isActive,
            durationMinutes,
          },
        });
      } else {
        throw error;
      }
    }

    await ensureUserCategory(
      me.id,
      category.id,
      category.displayName || category.name,
      me.categoryId,
    );

    return res.json({ item });
  }),
);

servicesRouter.put(
  "/services/items/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { id: true, profileType: true, categoryId: true },
    });
    if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const item = await prisma.serviceItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item || item.ownerId !== me.id)
      return res.status(404).json({ error: "NOT_FOUND" });
    const { title, description, price } = req.body as Record<string, string>;
    const addressLabel =
      typeof req.body?.addressLabel === "string"
        ? req.body.addressLabel
        : typeof req.body?.address === "string"
          ? req.body.address
          : null;
    // Nota: ignoramos `locality` (barrio/comuna) para mantener compatibilidad con Prisma schema.
    const approxAreaM =
      req.body?.approxAreaM != null &&
      Number.isFinite(Number(req.body.approxAreaM))
        ? Math.max(200, Math.min(1200, Number(req.body.approxAreaM)))
        : null;
    const categoryId =
      typeof req.body?.categoryId === "string" ? req.body.categoryId : null;
    const categorySlug =
      typeof req.body?.categorySlug === "string" ? req.body.categorySlug : null;
    const categoryName =
      typeof req.body?.category === "string" ? req.body.category : null;
    const latitude =
      req.body?.latitude != null &&
      req.body?.latitude !== "" &&
      Number.isFinite(Number(req.body.latitude))
        ? Number(req.body.latitude)
        : null;
    const longitude =
      req.body?.longitude != null &&
      req.body?.longitude !== "" &&
      Number.isFinite(Number(req.body.longitude))
        ? Number(req.body.longitude)
        : null;
    const nextIsActive =
      typeof req.body?.isActive === "boolean"
        ? req.body.isActive
        : item.isActive;
    const locationVerified = req.body?.locationVerified === true;
    const durationMinutes =
      req.body?.durationMinutes != null &&
      req.body?.durationMinutes !== "" &&
      Number.isFinite(Number(req.body.durationMinutes))
        ? Math.max(
            15,
            Math.min(600, Math.round(Number(req.body.durationMinutes))),
          )
        : null;
    const kind =
      me.profileType === "ESTABLISHMENT"
        ? "ESTABLISHMENT"
        : me.profileType === "SHOP"
          ? "SHOP"
          : "PROFESSIONAL";
    const nextCategory = await findCategoryByRef(prisma, {
      categoryId,
      categorySlug,
      categoryName,
      kind,
    });
    if ((categoryId || categorySlug || categoryName) && !nextCategory) {
      return res.status(400).json({
        error: "CATEGORY_INVALID",
        message:
          "La categoría seleccionada no existe. Actualiza la página e intenta nuevamente.",
      });
    }
    if (nextIsActive) {
      await prisma.serviceItem.updateMany({
        where: { ownerId: me.id, isActive: true, id: { not: item.id } },
        data: { isActive: false },
      });
    }
    const wantsLocationUpdate =
      req.body?.locationVerified != null ||
      req.body?.latitude != null ||
      req.body?.longitude != null ||
      req.body?.addressLabel != null ||
      req.body?.address != null ||
      req.body?.approxAreaM != null;
    if (
      wantsLocationUpdate &&
      (!locationVerified ||
        !addressLabel ||
        latitude == null ||
        longitude == null)
    ) {
      return res.status(400).json({
        error: "LOCATION_NOT_VERIFIED",
        message: "Debes confirmar la dirección en el mapa antes de publicar.",
      });
    }

    let updated;
    try {
      updated = await prisma.serviceItem.update({
        where: { id: item.id },
        data: {
          title: title || item.title,
          description: description ?? item.description,
          category: nextCategory
            ? nextCategory.displayName || nextCategory.name
            : item.category,
          categoryId: nextCategory ? nextCategory.id : item.categoryId,
          price: price ? Number(price) : item.price,
          address: wantsLocationUpdate
            ? (addressLabel ?? item.address)
            : item.address,
          latitude: wantsLocationUpdate ? latitude : item.latitude,
          longitude: wantsLocationUpdate ? longitude : item.longitude,
          approxAreaM: wantsLocationUpdate
            ? (approxAreaM ?? item.approxAreaM)
            : item.approxAreaM,
          locationVerified: wantsLocationUpdate
            ? locationVerified
            : item.locationVerified,
          isActive: nextIsActive,
          durationMinutes:
            req.body?.durationMinutes !== undefined
              ? durationMinutes
              : item.durationMinutes,
        },
        include: { media: true },
      });
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2022") ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        updated = await prisma.serviceItem.update({
          where: { id: item.id },
          data: {
            title: title || item.title,
            description: description ?? item.description,
            category: nextCategory
              ? nextCategory.displayName || nextCategory.name
              : item.category,
            categoryId: nextCategory ? nextCategory.id : item.categoryId,
            price: price ? Number(price) : item.price,
            address: wantsLocationUpdate
              ? (addressLabel ?? item.address)
              : item.address,
            latitude: wantsLocationUpdate ? latitude : item.latitude,
            longitude: wantsLocationUpdate ? longitude : item.longitude,
            isActive: nextIsActive,
            durationMinutes:
              req.body?.durationMinutes !== undefined
                ? durationMinutes
                : item.durationMinutes,
          },
          include: { media: true },
        });
      } else {
        throw error;
      }
    }
    await ensureUserCategory(
      me.id,
      updated.categoryId,
      updated.category ?? null,
      me.categoryId,
    );
    return res.json({ item: updated });
  }),
);

servicesRouter.delete(
  "/services/items/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { id: true, profileType: true, categoryId: true },
    });
    if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const item = await prisma.serviceItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item || item.ownerId !== me.id)
      return res.status(404).json({ error: "NOT_FOUND" });
    await prisma.serviceItem.delete({ where: { id: item.id } });
    return res.json({ ok: true });
  }),
);

servicesRouter.post(
  "/services/items/:id/media",
  requireAuth,
  upload.array("files", 8),
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { id: true, profileType: true, categoryId: true },
    });
    if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const item = await prisma.serviceItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item || item.ownerId !== me.id)
      return res.status(404).json({ error: "NOT_FOUND" });

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ error: "NO_FILES" });
    const media = [];
    for (const file of files) {
      const { type } = await validateUploadedFile(file, "image-or-video");
      const url = storageProvider.publicUrl(file.filename);
      media.push(
        await prisma.serviceMedia.create({
          data: { serviceItemId: item.id, type, url },
        }),
      );
    }
    return res.json({ media });
  }),
);

servicesRouter.delete(
  "/services/items/:id/media/:mediaId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { id: true, profileType: true, categoryId: true },
    });
    if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
    const item = await prisma.serviceItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item || item.ownerId !== me.id)
      return res.status(404).json({ error: "NOT_FOUND" });
    const media = await prisma.serviceMedia.findUnique({
      where: { id: req.params.mediaId },
    });
    if (!media || media.serviceItemId !== item.id)
      return res.status(404).json({ error: "NOT_FOUND" });
    await prisma.serviceMedia.delete({ where: { id: media.id } });
    return res.json({ ok: true });
  }),
);

servicesRouter.post(
  "/services/:userId/rating",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "INVALID_RATING" });
    }
    const profileId = req.params.userId;
    const raterId = req.session.userId!;
    const created = await prisma.serviceRating.upsert({
      where: { profileId_raterId: { profileId, raterId } },
      update: { rating },
      create: { profileId, raterId, rating },
    });
    return res.json({ rating: created });
  }),
);

servicesRouter.post(
  "/services/request",
  requireAuth,
  asyncHandler(async (req, res) => {
    const professionalId =
      typeof req.body?.professionalId === "string"
        ? req.body.professionalId
        : null;
    const requestedDate =
      typeof req.body?.date === "string" ? req.body.date.trim() : "";
    const requestedTime =
      typeof req.body?.time === "string" ? req.body.time.trim() : "";
    const agreedLocation =
      typeof req.body?.location === "string" ? req.body.location.trim() : "";
    const clientComment =
      typeof req.body?.comment === "string" ? req.body.comment.trim() : "";

    if (!professionalId)
      return res.status(400).json({ error: "INVALID_PROFESSIONAL" });
    if (!requestedDate || !requestedTime || !agreedLocation) {
      return res.status(400).json({ error: "MISSING_REQUEST_FIELDS" });
    }

    const activeStatuses = [
      "PENDIENTE_APROBACION",
      "APROBADO",
      "ACTIVO",
      "PENDIENTE_EVALUACION",
    ] as const;

    const existing = await prisma.serviceRequest.findFirst({
      where: {
        clientId: req.session.userId!,
        professionalId,
        status: { in: activeStatuses },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return res.json({ request: existing });

    const request = await prisma.serviceRequest.create({
      data: {
        clientId: req.session.userId!,
        professionalId,
        status: "PENDIENTE_APROBACION",
        requestedDate,
        requestedTime,
        agreedLocation,
        clientComment: clientComment || null,
      },
      include: {
        client: {
          select: { id: true, displayName: true, username: true, phone: true },
        },
        professional: {
          select: { id: true, displayName: true, username: true, phone: true },
        },
      },
    });

    await createServiceNotification(
      professionalId,
      "Nuevo servicio solicitado",
      "Recibiste una nueva solicitud de servicio.",
      {
        url: `/dashboard/services?request=${request.id}`,
        requestId: request.id,
        status: request.status,
      },
    );

    sendToUser(professionalId, "service_request", { request });
    sendToUser(req.session.userId!, "service_request", { request });
    return res.json({ request });
  }),
);

servicesRouter.get(
  "/services/active",
  requireAuth,
  asyncHandler(async (req, res) => {
    const activeStatuses = [
      "PENDIENTE_APROBACION",
      "APROBADO",
      "ACTIVO",
      "PENDIENTE_EVALUACION",
    ] as const;

    const services = await prisma.serviceRequest.findMany({
      where: {
        clientId: req.session.userId!,
        status: { in: activeStatuses },
      },
      include: {
        professional: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
            category: true,
            isActive: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      services: services.map((s) => ({
        id: s.id,
        status: s.status,
        createdAt: s.createdAt,
        requestedDate: s.requestedDate,
        requestedTime: s.requestedTime,
        agreedLocation: s.agreedLocation,
        clientComment: s.clientComment,
        professionalPriceClp: s.professionalPriceClp,
        professionalDurationM: s.professionalDurationM,
        professionalComment: s.professionalComment,
        contactUnlocked: s.status === "ACTIVO" || s.status === "FINALIZADO",
        professional: {
          id: s.professional.id,
          name: s.professional.displayName || s.professional.username,
          avatarUrl: s.professional.avatarUrl,
          category: s.professional.category?.name || null,
          isActive: s.professional.isActive,
          phone:
            s.status === "ACTIVO" || s.status === "FINALIZADO"
              ? s.professional.phone
              : null,
        },
      })),
    });
  }),
);

servicesRouter.get(
  "/services/requests/with/:otherUserId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const myUserId = req.session.userId!;
    const otherUserId = req.params.otherUserId;

    const service = await prisma.serviceRequest.findFirst({
      where: {
        OR: [
          { clientId: myUserId, professionalId: otherUserId },
          { clientId: otherUserId, professionalId: myUserId },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, displayName: true, username: true, phone: true },
        },
        professional: {
          select: { id: true, displayName: true, username: true, phone: true },
        },
      },
    });
    return res.json({ request: service });
  }),
);

servicesRouter.post(
  "/services/:id/approve",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const professionalId = req.session.userId!;

    const priceClp = Number(req.body?.priceClp);
    const durationMinutes = Number(req.body?.durationMinutes);
    const professionalComment =
      typeof req.body?.professionalComment === "string"
        ? req.body.professionalComment.trim()
        : "";

    if (!Number.isFinite(priceClp) || priceClp <= 0)
      return res.status(400).json({ error: "INVALID_PRICE_CLP" });
    if (![30, 60, 90, 120].includes(durationMinutes))
      return res.status(400).json({ error: "INVALID_DURATION_MINUTES" });

    const transition = await prisma.serviceRequest.updateMany({
      where: {
        id,
        professionalId,
        status: "PENDIENTE_APROBACION",
      },
      data: {
        status: "APROBADO",
        professionalPriceClp: Math.round(priceClp),
        professionalDurationM: durationMinutes,
        professionalComment: professionalComment || null,
      },
    });

    if (transition.count === 0)
      return res.status(400).json({ error: "INVALID_STATE" });

    const updated = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, displayName: true, username: true, phone: true },
        },
        professional: {
          select: { id: true, displayName: true, username: true, phone: true },
        },
      },
    });

    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });

    sendToUser(updated.clientId, "service_request", { request: updated });
    sendToUser(updated.professionalId, "service_request", { request: updated });
    return res.json({ service: updated });
  }),
);

servicesRouter.post(
  "/services/:id/reject",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const professionalId = req.session.userId!;

    const transition = await prisma.serviceRequest.updateMany({
      where: {
        id,
        professionalId,
        status: { in: ["PENDIENTE_APROBACION", "APROBADO"] },
      },
      data: { status: "RECHAZADO" },
    });

    if (transition.count === 0)
      return res.status(400).json({ error: "INVALID_STATE" });

    const updated = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });

    sendToUser(updated.clientId, "service_request", { request: updated });
    sendToUser(updated.professionalId, "service_request", { request: updated });
    return res.json({ service: updated });
  }),
);

servicesRouter.post(
  "/services/:id/client-confirm",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const clientId = req.session.userId!;

    const transition = await prisma.serviceRequest.updateMany({
      where: {
        id,
        clientId,
        status: "APROBADO",
      },
      data: { status: "ACTIVO" },
    });

    if (transition.count === 0)
      return res.status(400).json({ error: "INVALID_STATE" });

    const updated = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });

    sendToUser(updated.clientId, "service_request", { request: updated });
    sendToUser(updated.professionalId, "service_request", { request: updated });
    return res.json({ service: updated });
  }),
);

servicesRouter.post(
  "/services/:id/client-cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const clientId = req.session.userId!;

    const transition = await prisma.serviceRequest.updateMany({
      where: {
        id,
        clientId,
        status: "APROBADO",
      },
      data: { status: "CANCELADO_CLIENTE" },
    });

    if (transition.count === 0)
      return res.status(400).json({ error: "INVALID_STATE" });

    const updated = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });

    sendToUser(updated.clientId, "service_request", { request: updated });
    sendToUser(updated.professionalId, "service_request", { request: updated });
    return res.json({ service: updated });
  }),
);

servicesRouter.post(
  "/services/:id/finish",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const professionalId = req.session.userId!;

    const before = await prisma.serviceRequest.findUnique({
      where: { id },
      select: { id: true, clientId: true, professionalId: true, status: true },
    });
    if (!before || before.professionalId !== professionalId)
      return res.status(404).json({ error: "NOT_FOUND" });
    if (before.status !== "ACTIVO")
      return res.status(400).json({ error: "INVALID_STATE" });

    const updated = await prisma.$transaction(async (tx) => {
      const transition = await tx.serviceRequest.updateMany({
        where: {
          id,
          professionalId,
          status: "ACTIVO",
        },
        data: { status: "FINALIZADO" },
      });

      if (transition.count === 0) return null;

      const professional = await tx.user.update({
        where: { id: professionalId },
        data: { completedServices: { increment: 1 } },
        select: { completedServices: true },
      });

      const service = await tx.serviceRequest.findUnique({ where: { id } });
      if (!service) return null;

      await tx.notification.create({
        data: {
          userId: service.clientId,
          type: "SERVICE_PUBLISHED",
          data: {
            title: "Servicio finalizado",
            body: "¿Cómo fue tu experiencia? Etiqueta el servicio rápidamente.",
            action: "REQUEST_REVIEW_TAGS",
            serviceRequestId: service.id,
            professionalId,
            suggestedTags: QUICK_REVIEW_TAGS,
            professionalLevel: resolveProfessionalLevel(
              professional.completedServices,
            ),
          },
        },
      });

      return service;
    });

    if (!updated) return res.status(400).json({ error: "INVALID_STATE" });

    sendToUser(updated.clientId, "service_request", { request: updated });
    sendToUser(updated.professionalId, "service_request", { request: updated });
    return res.json({
      service: updated,
      reviewTagsRequested: true,
      suggestedTags: QUICK_REVIEW_TAGS,
    });
  }),
);

servicesRouter.post(
  "/services/:id/review-tags",
  requireAuth,
  asyncHandler(async (req, res) => {
    const requestId = req.params.id;
    const clientId = req.session.userId!;
    const rawTags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const tags = Array.from(
      new Set(
        rawTags
          .map((tag: unknown) => String(tag || "").trim())
          .filter((tag: string) =>
            QUICK_REVIEW_TAGS.some((allowed) => allowed === tag),
          ),
      ),
    );

    if (!tags.length) return res.status(400).json({ error: "INVALID_TAGS" });

    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clientId: true, professionalId: true, status: true },
    });

    if (!request || request.clientId !== clientId)
      return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "FINALIZADO")
      return res.status(400).json({ error: "INVALID_STATE" });

    const professional = await prisma.user.findUnique({
      where: { id: request.professionalId },
      select: { reviewTagsSummary: true },
    });
    if (!professional)
      return res.status(404).json({ error: "PROFESSIONAL_NOT_FOUND" });

    const summary: Record<string, number> = {};
    if (
      professional.reviewTagsSummary &&
      typeof professional.reviewTagsSummary === "object" &&
      !Array.isArray(professional.reviewTagsSummary)
    ) {
      for (const [key, value] of Object.entries(
        professional.reviewTagsSummary as Record<string, unknown>,
      )) {
        const count = Number(value);
        summary[key] = Number.isFinite(count) ? count : 0;
      }
    }

    for (const tag of tags) {
      const current = Number(summary[tag] || 0);
      summary[tag] = Number.isFinite(current) ? current + 1 : 1;
    }

    await prisma.user.update({
      where: { id: request.professionalId },
      data: { reviewTagsSummary: summary },
    });

    return res.json({ ok: true, tags, summary });
  }),
);


servicesRouter.get(
  "/services/:id/reviews",
  asyncHandler(async (req, res) => {
    const reviews = await prisma.serviceRating.findMany({
      where: { profileId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, rating: true, createdAt: true }
    });

    return res.json({
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: null, createdAt: r.createdAt.toISOString() }))
    });
  }),
);

servicesRouter.post(
  "/services/:id/review",
  requireAuth,
  asyncHandler(async (req, res) => {
    const hearts = Number(req.body?.hearts);
    if (!Number.isFinite(hearts) || hearts < 1 || hearts > 5) {
      return res.status(400).json({ error: "INVALID_RATING" });
    }
    const review = await prisma.professionalReview.create({
      data: {
        serviceRequestId: req.params.id,
        hearts,
        comment:
          typeof req.body?.comment === "string" ? req.body.comment : null,
      },
    });
    await prisma.serviceRequest.update({
      where: { id: req.params.id },
      data: { status: "FINALIZADO" },
    });
    return res.json({ review });
  }),
);
