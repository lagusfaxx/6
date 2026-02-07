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

export const servicesRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`
});
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
      const name = `${Date.now()}-${safeBase}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 }
});


async function ensureUserCategory(userId: string, categoryId: string | null, displayName: string | null, currentCategoryId: string | null) {
  if (!categoryId && !displayName) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      serviceCategory: displayName ?? undefined,
      categoryId: categoryId || currentCategoryId || null
    }
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

servicesRouter.get("/services", asyncHandler(async (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const types = typeof req.query.types === "string" ? req.query.types.split(",").map((t) => t.trim()) : [];

  const profiles = await prisma.user.findMany({
    where: {
      profileType: { in: types.length ? types : ["PROFESSIONAL", "SHOP"] },
      ...(q
        ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { serviceCategory: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } }
          ]
        }
        : {})
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
      profileType: true,
      membershipExpiresAt: true,
      shopTrialEndsAt: true
    }
  });

  const enriched = profiles.filter((p) => isBusinessPlanActive(p)).map((p) => {
    const distance =
      lat !== null && lng !== null && p.latitude !== null && p.longitude !== null
        ? haversine(lat, lng, p.latitude, p.longitude)
        : null;
    const obfuscated = obfuscateLocation(p.latitude, p.longitude, `services:${p.id}`, 700);
    return {
      ...p,
      latitude: obfuscated.latitude,
      longitude: obfuscated.longitude,
      locality: p.city || null,
      distance
    };
  });

  const sorted = enriched.sort((a, b) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });

  return res.json({ profiles: sorted });
}));

servicesRouter.get("/map", asyncHandler(async (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const types = typeof req.query.types === "string" ? req.query.types.split(",").map((t) => t.trim()) : [];

  const profiles = await prisma.user.findMany({
    where: {
      profileType: { in: types.length ? types : ["PROFESSIONAL", "SHOP"] },
      latitude: { not: null },
      longitude: { not: null }
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
      shopTrialEndsAt: true
    }
  });

  const enriched = profiles.filter((p) => isBusinessPlanActive(p)).map((p) => {
    const distance =
      lat !== null && lng !== null && p.latitude !== null && p.longitude !== null
        ? haversine(lat, lng, p.latitude, p.longitude)
        : null;
    const obfuscated = obfuscateLocation(p.latitude, p.longitude, `map:${p.id}`, 700);
    return {
      ...p,
      latitude: obfuscated.latitude,
      longitude: obfuscated.longitude,
      locality: p.city || null,
      distance
    };
  });

  return res.json({ profiles: enriched });
}));

servicesRouter.get("/services/:userId/items", asyncHandler(async (req, res) => {
  const items = await prisma.serviceItem.findMany({
    where: { ownerId: req.params.userId },
    orderBy: { createdAt: "desc" },
    include: { media: true, categoryRel: { select: { id: true, slug: true, displayName: true, name: true } } }
  });
  return res.json({ items });
}));

servicesRouter.post("/services/items", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { id: true, profileType: true, categoryId: true } });
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
  const locality = typeof req.body?.locality === "string" ? req.body.locality : null;
  const approxAreaM =
    req.body?.approxAreaM != null && Number.isFinite(Number(req.body.approxAreaM))
      ? Math.max(200, Math.min(1200, Number(req.body.approxAreaM)))
      : null;
  const categoryId = typeof req.body?.categoryId === "string" ? req.body.categoryId : null;
  const categorySlug = typeof req.body?.categorySlug === "string" ? req.body.categorySlug : null;
  const categoryName = typeof req.body?.category === "string" ? req.body.category : null;
  const latitude =
    req.body?.latitude != null && req.body?.latitude !== "" && Number.isFinite(Number(req.body.latitude))
      ? Number(req.body.latitude)
      : null;
  const longitude =
    req.body?.longitude != null && req.body?.longitude !== "" && Number.isFinite(Number(req.body.longitude))
      ? Number(req.body.longitude)
      : null;
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : true;
  const locationVerified = req.body?.locationVerified === true;
  if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });
  if (!locationVerified || !addressLabel || latitude == null || longitude == null) {
    return res.status(400).json({
      error: "LOCATION_NOT_VERIFIED",
      message: "Debes confirmar la dirección en el mapa antes de publicar."
    });
  }

  const kind = me.profileType === "ESTABLISHMENT" ? "ESTABLISHMENT" : me.profileType === "SHOP" ? "SHOP" : "PROFESSIONAL";
  const category = await findCategoryByRef(prisma, {
    categoryId,
    categorySlug,
    categoryName,
    kind
  });
  if (!category) {
    return res.status(400).json({
      error: "CATEGORY_INVALID",
      message: "La categoría seleccionada no existe. Actualiza la página e intenta nuevamente."
    });
  }

  if (isActive) {
    await prisma.serviceItem.updateMany({
      where: { ownerId: me.id, isActive: true },
      data: { isActive: false }
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
        locality: locality || null,
        approxAreaM,
        locationVerified,
        isActive
      }
    });
  } catch (error) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") ||
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
          isActive
        }
      });
    } else {
      throw error;
    }
  }

  await ensureUserCategory(me.id, category.id, category.displayName || category.name, me.categoryId);

  return res.json({ item });
}));

servicesRouter.put("/services/items/:id", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { id: true, profileType: true, categoryId: true } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  const item = await prisma.serviceItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.ownerId !== me.id) return res.status(404).json({ error: "NOT_FOUND" });
  const { title, description, price } = req.body as Record<string, string>;
  const addressLabel =
    typeof req.body?.addressLabel === "string"
      ? req.body.addressLabel
      : typeof req.body?.address === "string"
        ? req.body.address
        : null;
  const locality = typeof req.body?.locality === "string" ? req.body.locality : null;
  const approxAreaM =
    req.body?.approxAreaM != null && Number.isFinite(Number(req.body.approxAreaM))
      ? Math.max(200, Math.min(1200, Number(req.body.approxAreaM)))
      : null;
  const categoryId = typeof req.body?.categoryId === "string" ? req.body.categoryId : null;
  const categorySlug = typeof req.body?.categorySlug === "string" ? req.body.categorySlug : null;
  const categoryName = typeof req.body?.category === "string" ? req.body.category : null;
  const latitude =
    req.body?.latitude != null && req.body?.latitude !== "" && Number.isFinite(Number(req.body.latitude))
      ? Number(req.body.latitude)
      : null;
  const longitude =
    req.body?.longitude != null && req.body?.longitude !== "" && Number.isFinite(Number(req.body.longitude))
      ? Number(req.body.longitude)
      : null;
  const nextIsActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : item.isActive;
  const locationVerified = req.body?.locationVerified === true;
  const kind = me.profileType === "ESTABLISHMENT" ? "ESTABLISHMENT" : me.profileType === "SHOP" ? "SHOP" : "PROFESSIONAL";
  const nextCategory = await findCategoryByRef(prisma, {
    categoryId,
    categorySlug,
    categoryName,
    kind
  });
  if ((categoryId || categorySlug || categoryName) && !nextCategory) {
    return res.status(400).json({
      error: "CATEGORY_INVALID",
      message: "La categoría seleccionada no existe. Actualiza la página e intenta nuevamente."
    });
  }
  if (nextIsActive) {
    await prisma.serviceItem.updateMany({
      where: { ownerId: me.id, isActive: true, id: { not: item.id } },
      data: { isActive: false }
    });
  }
  const wantsLocationUpdate =
    req.body?.locationVerified != null ||
    req.body?.latitude != null ||
    req.body?.longitude != null ||
    req.body?.addressLabel != null ||
    req.body?.address != null ||
    req.body?.locality != null ||
    req.body?.approxAreaM != null;
  if (wantsLocationUpdate && (!locationVerified || !addressLabel || latitude == null || longitude == null)) {
    return res.status(400).json({
      error: "LOCATION_NOT_VERIFIED",
      message: "Debes confirmar la dirección en el mapa antes de publicar."
    });
  }

  let updated;
  try {
    updated = await prisma.serviceItem.update({
      where: { id: item.id },
      data: {
        title: title || item.title,
        description: description ?? item.description,
        category: nextCategory ? nextCategory.displayName || nextCategory.name : item.category,
        categoryId: nextCategory ? nextCategory.id : item.categoryId,
        price: price ? Number(price) : item.price,
        address: wantsLocationUpdate ? addressLabel ?? item.address : item.address,
        latitude: wantsLocationUpdate ? latitude : item.latitude,
        longitude: wantsLocationUpdate ? longitude : item.longitude,
        locality: wantsLocationUpdate ? locality ?? item.locality : item.locality,
        approxAreaM: wantsLocationUpdate ? approxAreaM ?? item.approxAreaM : item.approxAreaM,
        locationVerified: wantsLocationUpdate ? locationVerified : item.locationVerified,
        isActive: nextIsActive
      },
      include: { media: true }
    });
  } catch (error) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      updated = await prisma.serviceItem.update({
        where: { id: item.id },
        data: {
          title: title || item.title,
          description: description ?? item.description,
          category: nextCategory ? nextCategory.displayName || nextCategory.name : item.category,
          categoryId: nextCategory ? nextCategory.id : item.categoryId,
          price: price ? Number(price) : item.price,
          address: wantsLocationUpdate ? addressLabel ?? item.address : item.address,
          latitude: wantsLocationUpdate ? latitude : item.latitude,
          longitude: wantsLocationUpdate ? longitude : item.longitude,
          isActive: nextIsActive
        },
        include: { media: true }
      });
    } else {
      throw error;
    }
  }
  await ensureUserCategory(me.id, updated.categoryId, updated.category ?? null, me.categoryId);
  return res.json({ item: updated });
}));

servicesRouter.delete("/services/items/:id", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { id: true, profileType: true, categoryId: true } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  const item = await prisma.serviceItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.ownerId !== me.id) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.serviceItem.delete({ where: { id: item.id } });
  return res.json({ ok: true });
}));

servicesRouter.post("/services/items/:id/media", requireAuth, upload.array("files", 8), asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { id: true, profileType: true, categoryId: true } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  const item = await prisma.serviceItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.ownerId !== me.id) return res.status(404).json({ error: "NOT_FOUND" });

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) return res.status(400).json({ error: "NO_FILES" });
  const media = [];
  for (const file of files) {
    const { type } = await validateUploadedFile(file, "image-or-video");
    const url = storageProvider.publicUrl(file.filename);
    media.push(await prisma.serviceMedia.create({ data: { serviceItemId: item.id, type, url } }));
  }
  return res.json({ media });
}));

servicesRouter.delete("/services/items/:id/media/:mediaId", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { id: true, profileType: true, categoryId: true } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  const item = await prisma.serviceItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.ownerId !== me.id) return res.status(404).json({ error: "NOT_FOUND" });
  const media = await prisma.serviceMedia.findUnique({ where: { id: req.params.mediaId } });
  if (!media || media.serviceItemId !== item.id) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.serviceMedia.delete({ where: { id: media.id } });
  return res.json({ ok: true });
}));

servicesRouter.post("/services/:userId/rating", requireAuth, asyncHandler(async (req, res) => {
  const rating = Number(req.body?.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "INVALID_RATING" });
  }
  const profileId = req.params.userId;
  const raterId = req.session.userId!;
  const created = await prisma.serviceRating.upsert({
    where: { profileId_raterId: { profileId, raterId } },
    update: { rating },
    create: { profileId, raterId, rating }
  });
  return res.json({ rating: created });
}));

servicesRouter.post("/services/request", requireAuth, asyncHandler(async (req, res) => {
  const professionalId = typeof req.body?.professionalId === "string" ? req.body.professionalId : null;
  if (!professionalId) return res.status(400).json({ error: "INVALID_PROFESSIONAL" });

  const existing = await prisma.serviceRequest.findFirst({
    where: {
      clientId: req.session.userId!,
      professionalId,
      status: { notIn: ["FINALIZADO", "RECHAZADO"] }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return res.json({ request: existing });

  const request = await prisma.serviceRequest.create({
    data: {
      clientId: req.session.userId!,
      professionalId,
      status: "PENDIENTE_APROBACION"
    }
  });
  return res.json({ request });
}));

servicesRouter.get("/services/active", requireAuth, asyncHandler(async (req, res) => {
  const services = await prisma.serviceRequest.findMany({
    where: {
      clientId: req.session.userId!,
      status: { notIn: ["FINALIZADO", "RECHAZADO"] }
    },
    include: {
      professional: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          category: true,
          isActive: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json({
    services: services.map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      professional: {
        id: s.professional.id,
        name: s.professional.displayName || s.professional.username,
        avatarUrl: s.professional.avatarUrl,
        category: s.professional.category?.name || null,
        isActive: s.professional.isActive
      }
    }))
  });
}));

servicesRouter.get("/services/requests/with/:clientId", requireAuth, asyncHandler(async (req, res) => {
  const service = await prisma.serviceRequest.findFirst({
    where: {
      clientId: req.params.clientId,
      professionalId: req.session.userId!
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, displayName: true, username: true } }
    }
  });
  return res.json({ request: service });
}));

servicesRouter.post("/services/:id/approve", requireAuth, asyncHandler(async (req, res) => {
  const current = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "NOT_FOUND" });
  if (current.professionalId !== req.session.userId) {
    return res.status(403).json({ error: "NOT_ALLOWED" });
  }
  const updated = await prisma.serviceRequest.update({
    where: { id: req.params.id },
    data: { status: "ACTIVO" }
  });
  return res.json({ service: updated });
}));

servicesRouter.post("/services/:id/reject", requireAuth, asyncHandler(async (req, res) => {
  const current = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "NOT_FOUND" });
  if (current.professionalId !== req.session.userId) {
    return res.status(403).json({ error: "NOT_ALLOWED" });
  }
  const updated = await prisma.serviceRequest.update({
    where: { id: req.params.id },
    data: { status: "RECHAZADO" }
  });
  return res.json({ service: updated });
}));

servicesRouter.post("/services/:id/finish", requireAuth, asyncHandler(async (req, res) => {
  const updated = await prisma.serviceRequest.update({
    where: { id: req.params.id },
    data: { status: "PENDIENTE_EVALUACION" }
  });
  return res.json({ service: updated });
}));

servicesRouter.post("/services/:id/review", requireAuth, asyncHandler(async (req, res) => {
  const hearts = Number(req.body?.hearts);
  if (!Number.isFinite(hearts) || hearts < 1 || hearts > 5) {
    return res.status(400).json({ error: "INVALID_RATING" });
  }
  const review = await prisma.professionalReview.create({
    data: {
      serviceRequestId: req.params.id,
      hearts,
      comment: typeof req.body?.comment === "string" ? req.body.comment : null
    }
  });
  await prisma.serviceRequest.update({
    where: { id: req.params.id },
    data: { status: "FINALIZADO" }
  });
  return res.json({ review });
}));
