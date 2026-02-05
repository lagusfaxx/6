import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { isBusinessPlanActive } from "../lib/subscriptions";
import multer from "multer";
import path from "path";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/local";
import { validateUploadedFile } from "../lib/uploads";
import { asyncHandler } from "../lib/asyncHandler";

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
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      address: true,
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
    return { ...p, distance };
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
    return { ...p, distance };
  });

  return res.json({ profiles: enriched });
}));

servicesRouter.get("/services/:userId/items", asyncHandler(async (req, res) => {
  const items = await prisma.serviceItem.findMany({
    where: { ownerId: req.params.userId },
    orderBy: { createdAt: "desc" },
    include: { media: true }
  });
  return res.json({ items });
}));

servicesRouter.post("/services/items", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  if (!["SHOP", "PROFESSIONAL"].includes(me.profileType)) {
    return res.status(403).json({ error: "NOT_ALLOWED" });
  }
  const { title, description, category, price } = req.body as Record<string, string>;
  if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });

  const item = await prisma.serviceItem.create({
    data: {
      ownerId: me.id,
      title,
      description,
      category,
      price: price ? Number(price) : null
    }
  });
  return res.json({ item });
}));

servicesRouter.put("/services/items/:id", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  const item = await prisma.serviceItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.ownerId !== me.id) return res.status(404).json({ error: "NOT_FOUND" });
  const { title, description, category, price } = req.body as Record<string, string>;
  const updated = await prisma.serviceItem.update({
    where: { id: item.id },
    data: {
      title: title || item.title,
      description: description ?? item.description,
      category: category ?? item.category,
      price: price ? Number(price) : item.price
    },
    include: { media: true }
  });
  return res.json({ item: updated });
}));

servicesRouter.delete("/services/items/:id", requireAuth, asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! } });
  if (!me) return res.status(404).json({ error: "USER_NOT_FOUND" });
  const item = await prisma.serviceItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.ownerId !== me.id) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.serviceItem.delete({ where: { id: item.id } });
  return res.json({ ok: true });
}));

servicesRouter.post("/services/items/:id/media", requireAuth, upload.array("files", 8), asyncHandler(async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! } });
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
  const me = await prisma.user.findUnique({ where: { id: req.session.userId! } });
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
      status: { not: "FINALIZADO" }
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

servicesRouter.post("/services/:id/approve", requireAuth, asyncHandler(async (req, res) => {
  const updated = await prisma.serviceRequest.update({
    where: { id: req.params.id },
    data: { status: "ACTIVO" }
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
