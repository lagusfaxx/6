import { randomUUID } from "node:crypto";
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { sendToUser } from "../realtime/sse";
import { normalizeDisplayName } from "../profile/nameChange";
import multer from "multer";
import path from "path";
import { unlink } from "node:fs/promises";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { validateUploadedFile } from "../lib/uploads";
import { optimizeUploadedImage } from "../lib/imageOptimizer";
import { cleanMotelAmenities, cleanRoomAmenities } from "@uzeed/shared/motel";
import { loadMotelDetail, loadMotelDirectory } from "./directory";
import { safeUploadFilename } from "../lib/uploadFilename";

/* Fotos de habitaciones: se guardan como archivo suelto, sin pasar por la
   galería del perfil (antes cada foto de habitación aparecía repetida en la
   galería del local). */
const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`,
});
const roomPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      cb(null, safeUploadFilename(file, "room-"));
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, (file.mimetype || "").toLowerCase().startsWith("image/")),
});

export const motelRouter = Router();

let schemaReady = false;
async function ensureMotelSchema() {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MotelBooking" (
      "id" UUID PRIMARY KEY,
      "establishmentId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "roomId" UUID NULL REFERENCES "MotelRoom"("id") ON DELETE SET NULL,
      "clientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
      "durationType" TEXT NOT NULL,
      "priceClp" INTEGER NOT NULL,
      "startAt" TIMESTAMP NULL,
      "note" TEXT NULL,
      "rejectReason" TEXT NULL,
      "rejectNote" TEXT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MotelBooking_establishmentId_idx" ON "MotelBooking" ("establishmentId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MotelBooking_clientId_idx" ON "MotelBooking" ("clientId")`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "roomType" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "price3h" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "price6h" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "priceNight" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[]`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[]`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "location" TEXT`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "discountClp" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "roomId" UUID`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "roomIds" UUID[] DEFAULT ARRAY[]::UUID[]`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "rejectNote" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "basePriceClp" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "discountClp" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "confirmationCode" TEXT`);

  schemaReady = true;
}

function isMotelOwner(user: any) {
  if (!user) return false;
  const role = String(user.role || "").toUpperCase();
  const profileType = String(user.profileType || "").toUpperCase();
  return profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

async function sendBookingMessage(fromId: string, toId: string, text: string) {
  const body = String(text || "").trim();
  if (!body) return;
  try {
    const message = await prisma.message.create({ data: { fromId, toId, body } });
    await prisma.notification.create({
      data: {
        userId: toId,
        type: "MESSAGE_RECEIVED",
        data: { title: "Mensaje de reserva", body: body.slice(0, 100), fromId, messageId: message.id, url: `/chat/${fromId}` }
      }
    }).catch((err) => {
      console.error("[motel] sendBookingMessage notification failed:", err?.message || err);
    });
    sendToUser(toId, "message", { message });
  } catch (err: any) {
    console.error("[motel] sendBookingMessage failed:", err?.message || err);
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function motelRoomDelegate() {
  return (prisma as any).motelRoom as any;
}

function motelPromotionDelegate() {
  return (prisma as any).motelPromotion as any;
}

async function listRooms(establishmentId: string, onlyActive = false) {
  const delegate = motelRoomDelegate();
  if (delegate?.findMany) {
    return delegate.findMany({
      where: { establishmentId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { createdAt: "desc" }
    });
  }

  return prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "MotelRoom" WHERE "establishmentId" = $1::uuid ${onlyActive ? 'AND "isActive" = true' : ""} ORDER BY "createdAt" DESC`,
    establishmentId
  );
}

async function listPromotions(establishmentId: string, onlyActive = false) {
  await prisma.$executeRawUnsafe(
    `UPDATE "MotelPromotion" SET "isActive" = false, "updatedAt" = NOW() WHERE "establishmentId" = $1::uuid AND "isActive" = true AND "endsAt" IS NOT NULL AND "endsAt" < NOW()`,
    establishmentId
  );

  const delegate = motelPromotionDelegate();
  if (delegate?.findMany) {
    return delegate.findMany({
      where: { establishmentId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { createdAt: "desc" }
    });
  }

  return prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "MotelPromotion" WHERE "establishmentId" = $1::uuid ${onlyActive ? 'AND "isActive" = true' : ""} ORDER BY "createdAt" DESC`,
    establishmentId
  );
}

async function findRoomForBooking(establishmentId: string, roomId?: string | null) {
  const delegate = motelRoomDelegate();
  if (delegate?.findFirst) {
    if (roomId) {
      const exact = await delegate.findFirst({ where: { id: roomId, establishmentId, isActive: true } });
      if (exact) return exact;
    }
    return delegate.findFirst({ where: { establishmentId, isActive: true }, orderBy: { createdAt: "asc" } });
  }

  if (roomId) {
    const exact = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "MotelRoom" WHERE id = $1::uuid AND "establishmentId" = $2::uuid AND "isActive" = true LIMIT 1`,
      roomId,
      establishmentId
    );
    if (exact[0]) return exact[0];
  }

  const fallback = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "MotelRoom" WHERE "establishmentId" = $1::uuid AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`,
    establishmentId
  );
  return fallback[0] || null;
}

const DURATION_TYPES = ["3H", "6H", "NIGHT"] as const;

/** Precio de la habitación para la duración pedida; 0 si el motel no la ofrece. */
function roomPriceFor(room: any, durationType: string) {
  if (durationType === "6H") return Number(room?.price6h || 0);
  if (durationType === "NIGHT") return Number(room?.priceNight || 0);
  return Number(room?.price3h || room?.price || 0);
}

/** Entero >= 0 o null. Evita guardar NaN cuando el formulario manda texto. */
function toPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Perfil completo del dueño: `req.user` sólo trae id, rol y tipo de perfil. */
async function loadOwnerProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, displayName: true, address: true, phone: true, city: true,
      latitude: true, longitude: true, coverUrl: true, avatarUrl: true, bio: true,
      serviceDescription: true, isVerified: true, isActive: true,
      businessOpen: true, businessPublished: true, profileTags: true,
      profileMedia: { where: { type: "IMAGE" }, orderBy: { createdAt: "desc" }, select: { id: true, url: true } },
    },
  });
}

function serializeOwnerProfile(u: NonNullable<Awaited<ReturnType<typeof loadOwnerProfile>>>) {
  return {
    id: u.id, username: u.username, displayName: u.displayName, address: u.address,
    phone: u.phone, city: u.city, latitude: u.latitude, longitude: u.longitude,
    coverUrl: u.coverUrl, avatarUrl: u.avatarUrl, rules: u.bio, schedule: u.serviceDescription,
    isVerified: u.isVerified, isActive: u.isActive,
    isOpen: u.businessOpen, isPublished: u.businessPublished,
    amenities: cleanMotelAmenities(u.profileTags),
    gallery: u.profileMedia,
    publicSlug: motelPublicSlug(u.username, u.id),
  };
}

function motelPublicSlug(username: string | null, id: string) {
  const u = String(username || "").toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,60}$/.test(u) ? u : id;
}

/* Fecha de última edición de la ficha pública (va al sitemap). */
function touchEdited(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { lastEditedAt: new Date() } }).catch(() => {});
}

function randomConfirmationCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function mapsLinkFrom(address?: string | null, city?: string | null, fallback?: string | null) {
  const raw = [address || "", city || ""].join(" ").trim() || String(fallback || "Ubicación");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}

async function resolveBookingPrice(establishmentId: string, roomId: string, durationType: string, basePriceClp: number) {
  const promos = await listPromotions(establishmentId, true).catch(() => [] as any[]);
  const now = Date.now();
  const promo = promos.find((p: any) =>
    (!p.startsAt || new Date(p.startsAt).getTime() <= now) &&
    /* Sin habitaciones elegidas, la promo vale para todas. */
    (p.roomId === roomId ||
      (Array.isArray(p.roomIds) && p.roomIds.includes(roomId)) ||
      (!p.roomId && (!Array.isArray(p.roomIds) || p.roomIds.length === 0)))
  );
  if (!promo) return { basePriceClp, discountClp: 0, finalPriceClp: basePriceClp };
  const discount = promo.discountPercent
    ? Math.round(basePriceClp * (Number(promo.discountPercent) / 100))
    : promo.discountClp
      ? Number(promo.discountClp)
      : 0;
  const finalPriceClp = Math.max(0, basePriceClp - Math.max(0, discount));
  return { basePriceClp, discountClp: Math.max(0, basePriceClp - finalPriceClp), finalPriceClp };
}

async function getBookingWithDetails(bookingId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT b.*, r."name" as "roomName", e."displayName" as "establishmentName", e."address" as "establishmentAddress", e."city" as "establishmentCity", e."latitude" as "establishmentLat", e."longitude" as "establishmentLng"
     FROM "MotelBooking" b
     LEFT JOIN "MotelRoom" r ON r.id = b."roomId"
     LEFT JOIN "User" e ON e.id = b."establishmentId"
     WHERE b.id = $1::uuid
     LIMIT 1`,
    bookingId
  );
  return rows[0] || null;
}

/* Directorio público: la web lo pide al renderizar /moteles y sus landings
   por comuna (se cachea un minuto en el navegador y en la CDN). */
motelRouter.get("/motels/directory", asyncHandler(async (_req, res) => {
  await ensureMotelSchema();
  const motels = await loadMotelDirectory();
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  return res.json({ motels });
}));

/* Ficha pública (/motel/{slug}): por username, id de cuenta o id de ficha del equipo. */
motelRouter.get("/motels/page/:ref", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const motel = await loadMotelDetail(String(req.params.ref || ""), req.session.userId || null);
  if (!motel) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ motel });
}));

/* Reseña de un motel. Sólo quien reservó por UZEED y el motel aceptó
   (confirmada o finalizada) puede dejarla: así no hay reseñas falsas de la
   competencia. Una por cliente y motel; volver a enviar la actualiza. La tabla
   tiene "clientId" aunque el modelo de Prisma no lo declara: va por SQL. */
motelRouter.post("/motels/:id/reviews", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const clientId = req.session.userId;
  if (!clientId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const establishmentId = String(req.params.id || "");
  if (!isUuid(establishmentId)) return res.status(404).json({ error: "NOT_FOUND" });
  if (establishmentId === clientId) return res.status(400).json({ error: "OWN_ESTABLISHMENT", message: "No puedes reseñar tu propio motel." });

  const stars = Math.round(Number(req.body?.stars));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: "INVALID_STARS", message: "Elige de 1 a 5 estrellas." });
  }
  const comment = req.body?.comment ? String(req.body.comment).trim().slice(0, 600) || null : null;

  const motel = await prisma.user.findFirst({ where: { id: establishmentId, profileType: "ESTABLISHMENT" }, select: { id: true } });
  if (!motel) return res.status(404).json({ error: "NOT_FOUND" });

  const stays = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "MotelBooking" WHERE "establishmentId" = $1::uuid AND "clientId" = $2::uuid AND "status" IN ('CONFIRMADA','FINALIZADA') LIMIT 1`,
    establishmentId,
    clientId
  );
  if (!stays.length) {
    return res.status(403).json({ error: "NO_STAY", message: "Sólo pueden dejar reseña quienes reservaron este motel por UZEED." });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstablishmentReview" ("establishmentId", "clientId", "stars", "comment")
     VALUES ($1::uuid, $2::uuid, $3, $4)
     ON CONFLICT ("establishmentId", "clientId") DO UPDATE SET "stars" = EXCLUDED."stars", "comment" = EXCLUDED."comment", "createdAt" = NOW()`,
    establishmentId,
    clientId,
    stars,
    comment
  );
  return res.json({ ok: true });
}));

motelRouter.get("/motels", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const category = String(req.query.category || "").toLowerCase();
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 20)));
  const priceMax = Number(req.query.priceMax || 0);
  const duration = String(req.query.duration || "3H").toUpperCase();
  const onlyPromos = String(req.query.onlyPromos || "false") === "true";
  const minRating = req.query.minRating ? Number(req.query.minRating) : null;
  const search = String(req.query.search || "").trim().toLowerCase();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      businessPublished: true,
      OR: [
        { profileType: "ESTABLISHMENT" },
        { serviceCategory: { contains: "motel", mode: "insensitive" } },
        { serviceCategory: { contains: "hotel", mode: "insensitive" } }
      ]
    },
    select: {
      id: true, username: true, displayName: true, city: true, address: true,
      latitude: true, longitude: true, coverUrl: true, businessOpen: true,
      category: { select: { slug: true, displayName: true, name: true } },
      profileMedia: { where: { type: "IMAGE" }, take: 4, orderBy: { createdAt: "desc" }, select: { url: true } }
    },
    take: 300
  });

  const establishmentIds = users.map((u) => u.id);
  const [roomRows, promoRows] = await Promise.all([
    establishmentIds.length
      ? prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MotelRoom" WHERE "establishmentId" = ANY($1::uuid[]) AND "isActive" = true`, establishmentIds).catch(() => [] as any[])
      : Promise.resolve([] as any[]),
    establishmentIds.length
      ? prisma.$queryRawUnsafe<any[]>(`SELECT id, "establishmentId" FROM "MotelPromotion" WHERE "establishmentId" = ANY($1::uuid[]) AND "isActive" = true`, establishmentIds).catch(() => [] as any[])
      : Promise.resolve([] as any[])
  ]);

  const roomMap = new Map<string, any[]>();
  roomRows.forEach((row) => {
    const list = roomMap.get(row.establishmentId) || [];
    list.push(row);
    roomMap.set(row.establishmentId, list);
  });

  const promoMap = new Map<string, number>();
  promoRows.forEach((row) => {
    promoMap.set(row.establishmentId, (promoMap.get(row.establishmentId) || 0) + 1);
  });

  const reviewRows = await prisma.establishmentReview.groupBy({ by: ["establishmentId"], _avg: { stars: true }, _count: { _all: true } }).catch(() => [] as any[]);
  const reviewMap = new Map(reviewRows.map((r: any) => [r.establishmentId, { rating: r._avg?.stars ?? null, reviews: r._count?._all || 0 }]));

  const toDistance = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const aa = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
    return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
  };

  const mapped = users.map((u) => {
    const fallbackLat = -33.4489;
    const fallbackLng = -70.6693;
    const safeLat = u.latitude ?? fallbackLat;
    const safeLng = u.longitude ?? fallbackLng;
    const categoryName = `${u.category?.slug || ""} ${u.category?.displayName || ""} ${u.category?.name || ""}`.toLowerCase();
    const isHotel = categoryName.includes("hotel");
    const distance = lat != null && lng != null ? toDistance(lat, lng, safeLat, safeLng) : null;
    const motelRooms = roomMap.get(u.id) || [];
    const motelPromotionsCount = promoMap.get(u.id) || 0;
    const roomPrices = motelRooms.map((r: any) => roomPriceFor(r, duration)).filter((p) => p > 0);
    const fromPrice = roomPrices.length ? Math.min(...roomPrices) : 0;

    const tags = new Set<string>();
    motelRooms.forEach((r: any) => {
      (r.amenities || []).forEach((a: string) => tags.add(a));
      if ((r.roomType || "").toLowerCase().includes("jacuzzi")) tags.add("Jacuzzi");
    });
    if (motelPromotionsCount > 0) tags.add("Promo");

    return {
      id: u.id,
      name: u.displayName || u.username,
      address: u.address,
      city: u.city,
      latitude: safeLat,
      longitude: safeLng,
      distance,
      rating: reviewMap.get(u.id)?.rating ? Number((reviewMap.get(u.id)?.rating || 0).toFixed(2)) : null,
      reviewsCount: reviewMap.get(u.id)?.reviews || 0,
      fromPrice,
      coverUrl: u.coverUrl || u.profileMedia[0]?.url || null,
      tags: Array.from(tags).slice(0, 5),
      hasPromo: motelPromotionsCount > 0,
      category: isHotel ? "HOTEL" : "MOTEL",
      isOpen: u.businessOpen
    };
  })
  .filter((u) => (category === "hotel" ? u.category === "HOTEL" : category === "motel" ? u.category === "MOTEL" : true))
  .filter((u) => (search ? `${u.city} ${u.address} ${u.name}`.toLowerCase().includes(search) : true))
  .filter((u) => (u.distance != null ? u.distance <= rangeKm : true))
  .filter((u) => (onlyPromos ? u.hasPromo : true))
  .filter((u) => (priceMax ? u.fromPrice <= priceMax : true))
  .filter((u) => (minRating != null ? (u.rating || 0) >= minRating : true))
  .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  /* ── Quick listings (externalOnly) from Establishment table ── */
  const quickListings = await prisma.establishment.findMany({
    where: {
      externalOnly: true,
      category: { kind: "ESTABLISHMENT" },
    },
    include: { category: { select: { id: true, name: true, displayName: true, slug: true } } },
  });

  const quickMapped = quickListings.map((ql) => {
    const safeLat = ql.latitude ?? -33.4489;
    const safeLng = ql.longitude ?? -70.6693;
    const distance = lat != null && lng != null ? toDistance(lat, lng, safeLat, safeLng) : null;
    const catSlug = (ql.category?.slug || "").toLowerCase();
    const catName = (ql.category?.displayName || ql.category?.name || "").toLowerCase();
    const isHotel = catSlug.includes("hotel") || catName.includes("hotel");
    return {
      id: ql.id,
      name: ql.name,
      address: ql.address,
      city: ql.city,
      latitude: safeLat,
      longitude: safeLng,
      distance,
      rating: reviewMap.get(ql.id)?.rating ? Number((reviewMap.get(ql.id)?.rating || 0).toFixed(2)) : null,
      reviewsCount: reviewMap.get(ql.id)?.reviews || 0,
      fromPrice: 0,
      coverUrl: ql.galleryUrls?.[0] || null,
      tags: [] as string[],
      hasPromo: false,
      category: isHotel ? "HOTEL" : "MOTEL",
      isOpen: true,
      websiteUrl: ql.websiteUrl,
      externalOnly: true,
    };
  })
    .filter((ql) => (category === "hotel" ? ql.category === "HOTEL" : category === "motel" ? ql.category === "MOTEL" : true))
    .filter((ql) => (search ? `${ql.city} ${ql.address} ${ql.name}`.toLowerCase().includes(search) : true))
    .filter((ql) => (ql.distance != null ? ql.distance <= rangeKm : true));

  const all = [...mapped, ...quickMapped].sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({ establishments: all });
}));

motelRouter.get("/motels/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const rawId = String(req.params.id || "").trim();
  const byId = isUuid(rawId)
    ? await prisma.user.findFirst({
      where: {
        id: rawId,
        OR: [
          { profileType: "ESTABLISHMENT" },
          { serviceCategory: { contains: "motel", mode: "insensitive" } },
          { serviceCategory: { contains: "hotel", mode: "insensitive" } }
        ]
      },
      select: {
        id: true, username: true, displayName: true, address: true, city: true, phone: true,
        bio: true, serviceDescription: true, coverUrl: true, avatarUrl: true, latitude: true, longitude: true,
        isActive: true, businessOpen: true, businessPublished: true,
        profileMedia: { where: { type: "IMAGE" }, take: 16, orderBy: { createdAt: "desc" }, select: { url: true } }
      }
    })
    : null;

  const u = byId || await prisma.user.findFirst({
    where: {
      username: rawId,
      OR: [
        { profileType: "ESTABLISHMENT" },
        { serviceCategory: { contains: "motel", mode: "insensitive" } },
        { serviceCategory: { contains: "hotel", mode: "insensitive" } }
      ]
    },
    select: {
      id: true, username: true, displayName: true, address: true, city: true, phone: true,
      bio: true, serviceDescription: true, coverUrl: true, avatarUrl: true, latitude: true, longitude: true,
      isActive: true, businessOpen: true, businessPublished: true,
      profileMedia: { where: { type: "IMAGE" }, take: 16, orderBy: { createdAt: "desc" }, select: { url: true } }
    }
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });
  /* El dueño ve su ficha aunque esté oculta: es la vista previa del panel. */
  const isOwnerViewing = req.session.userId === u.id;
  if (!isOwnerViewing && (!u.isActive || !u.businessPublished)) {
    return res.status(404).json({ error: "NOT_FOUND", reason: "UNPUBLISHED" });
  }

  const id = u.id;
  const [rooms, promotions] = await Promise.all([
    listRooms(id, true).catch(() => [] as any[]),
    listPromotions(id, true).catch(() => [] as any[])
  ]);

  const reviews = await prisma.establishmentReview.groupBy({ by: ["establishmentId"], where: { establishmentId: id }, _avg: { stars: true }, _count: { _all: true } }).catch(() => [] as any[]);
  const rating = reviews[0]?._avg.stars ? Number((reviews[0]._avg.stars || 0).toFixed(2)) : null;
  const latitude = u.latitude ?? -33.4489;
  const longitude = u.longitude ?? -70.6693;

  return res.json({ establishment: { id: u.id, name: u.displayName || u.username, address: u.address, city: u.city, phone: u.phone, rules: u.bio, schedule: u.serviceDescription, isOpen: u.businessOpen, isPublished: u.businessPublished, coverUrl: u.coverUrl, avatarUrl: u.avatarUrl, latitude, longitude, rating, reviewsCount: reviews[0]?._count._all || 0, gallery: u.profileMedia.map((m) => m.url), rooms, promotions } });
}));

motelRouter.post("/motels/:id/bookings", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const clientId = req.session.userId;
  if (!clientId) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const establishmentId = String(req.params.id);
  if (!isUuid(establishmentId)) return res.status(404).json({ error: "NOT_FOUND" });
  if (establishmentId === clientId) {
    return res.status(400).json({ error: "OWN_ESTABLISHMENT", message: "No puedes reservar en tu propio local." });
  }
  const roomId = req.body?.roomId ? String(req.body.roomId) : null;
  const durationType = String(req.body?.durationType || "3H").toUpperCase();
  if (!(DURATION_TYPES as readonly string[]).includes(durationType)) {
    return res.status(400).json({ error: "INVALID_DURATION" });
  }
  const startAt = req.body?.startAt ? new Date(req.body.startAt) : null;
  if (startAt && Number.isNaN(startAt.getTime())) return res.status(400).json({ error: "INVALID_DATE" });
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;

  const establishment = await prisma.user.findUnique({
    where: { id: establishmentId },
    select: { isActive: true, businessOpen: true, businessPublished: true },
  });
  if (!establishment || !establishment.isActive || !establishment.businessPublished) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  if (!establishment.businessOpen) {
    return res.status(409).json({ error: "CLOSED", message: "El local está cerrado en este momento y no recibe reservas." });
  }

  const fallbackRoom = await findRoomForBooking(establishmentId, roomId);
  if (!fallbackRoom) return res.status(400).json({ error: "NO_ROOMS" });

  const basePriceClp = roomPriceFor(fallbackRoom, durationType);
  if (basePriceClp <= 0) {
    return res.status(400).json({ error: "DURATION_UNAVAILABLE", message: "Esta habitación no tiene tarifa para esa duración." });
  }
  const priced = await resolveBookingPrice(establishmentId, fallbackRoom.id, durationType, basePriceClp);

  const bookingId = randomUUID();
  const rows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO "MotelBooking" ("id", "establishmentId", "roomId", "clientId", "status", "durationType", "priceClp", "basePriceClp", "discountClp", "startAt", "note") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'PENDIENTE', $5, $6, $7, $8, $9, $10) RETURNING *`, bookingId, establishmentId, fallbackRoom.id, clientId, durationType, priced.finalPriceClp, priced.basePriceClp, priced.discountClp, startAt, note);
  const booking = rows[0];
  await prisma.notification.create({ data: { userId: establishmentId, type: "BOOKING_UPDATE", data: { title: "Nueva reserva pendiente", body: `Tienes una solicitud ${durationType}`, durationType, bookingId: booking.id, url: `/dashboard/motel?tab=bookings` } } }).catch((err) => {
    console.error("[motel] Failed to create booking notification:", err?.message || err);
  });
  sendToUser(establishmentId, "booking:new", { bookingId: booking.id });

  const roomName = fallbackRoom.name || "Habitación";
  const startLabel = startAt ? new Date(startAt).toLocaleString("es-CL") : "por confirmar";
  const discountLine = priced.discountClp > 0 ? `\n• Descuento: -$${Number(priced.discountClp || 0).toLocaleString("es-CL")}` : "";
  await sendBookingMessage(clientId, establishmentId, `Nueva solicitud de reserva\n• Duración: ${durationType}\n• Habitación: ${roomName}\n• Fecha/Hora: ${startLabel}\n• Monto final: $${Number(priced.finalPriceClp || 0).toLocaleString("es-CL")}${discountLine}\n${note ? `• Comentario: ${note}` : ""}`);

  return res.json({ booking });
}));

motelRouter.get("/motel/bookings/with/:userId", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const otherId = String(req.params.userId || "");
  if (!isUuid(otherId)) return res.status(400).json({ error: "INVALID_TARGET" });

  const relationRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT b.*, r."name" as "roomName", e."displayName" as "establishmentName", e."address" as "establishmentAddress", e."city" as "establishmentCity", e."latitude" as "establishmentLat", e."longitude" as "establishmentLng"
     FROM "MotelBooking" b
     LEFT JOIN "MotelRoom" r ON r.id = b."roomId"
     LEFT JOIN "User" e ON e.id = b."establishmentId"
     WHERE (b."establishmentId" = $1::uuid AND b."clientId" = $2::uuid) OR (b."establishmentId" = $2::uuid AND b."clientId" = $1::uuid)
     ORDER BY b."createdAt" DESC
     LIMIT 50`,
    userId,
    otherId
  );

  const meAsClient = relationRows.find((b) => b.clientId === userId);
  const meAsOwner = relationRows.find((b) => b.establishmentId === userId);

  let booking: any = null;
  if (meAsClient) {
    booking = relationRows.find((b) => b.clientId === userId && b.status === "CONFIRMADA")
      || relationRows.find((b) => b.clientId === userId && b.status === "ACEPTADA")
      || relationRows.find((b) => b.clientId === userId && b.status === "PENDIENTE")
      || relationRows.find((b) => b.clientId === userId)
      || null;
  } else if (meAsOwner) {
    booking = relationRows.find((b) => b.establishmentId === userId && b.status === "CONFIRMADA")
      || relationRows.find((b) => b.establishmentId === userId && b.status === "PENDIENTE")
      || relationRows.find((b) => b.establishmentId === userId)
      || null;
  }

  return res.json({ booking });
}));

motelRouter.get("/motel/bookings", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const isOwner = isMotelOwner((req as any).user);

  const bookingQuery = isOwner
    ? `SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE b."establishmentId" = $1::uuid ORDER BY b."createdAt" DESC LIMIT 300`
    : `SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE b."clientId" = $1::uuid ORDER BY b."createdAt" DESC LIMIT 300`;
  const rows = await prisma.$queryRawUnsafe<any[]>(bookingQuery, userId);
  return res.json({ bookings: rows });
}));

motelRouter.post("/motel/bookings/:id/action", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const user = (req as any).user;
  const id = String(req.params.id);
  const action = String(req.body?.action || "").toUpperCase();

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MotelBooking" WHERE id = $1::uuid LIMIT 1`, id);
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: "NOT_FOUND" });

  const isOwner = isMotelOwner(user) && booking.establishmentId === userId;
  const isClient = booking.clientId === userId;
  const rejectReason = String(req.body?.rejectReason || "").toUpperCase();
  const rejectNote = req.body?.rejectNote != null ? String(req.body.rejectNote).slice(0, 300) : null;

  let nextStatus: string | null = null;
  if (isOwner && action === "ACCEPT" && booking.status === "PENDIENTE") nextStatus = "ACEPTADA";
  if (isOwner && action === "REJECT" && booking.status === "PENDIENTE") {
    if (!["CERRADO", "SIN_HABITACIONES", "OTRO"].includes(rejectReason)) {
      return res.status(400).json({ error: "REJECT_REASON_REQUIRED" });
    }
    if (rejectReason === "OTRO" && !rejectNote) {
      return res.status(400).json({ error: "REJECT_NOTE_REQUIRED" });
    }
    nextStatus = "RECHAZADA";
  }
  if (isClient && action === "CONFIRM" && booking.status === "ACEPTADA") nextStatus = "CONFIRMADA";
  if (isOwner && action === "FINISH" && booking.status === "CONFIRMADA") nextStatus = "FINALIZADA";
  if (isClient && action === "CANCEL" && ["PENDIENTE", "ACEPTADA", "CONFIRMADA"].includes(booking.status)) nextStatus = "CANCELADA";
  if (!nextStatus) return res.status(400).json({ error: "INVALID_TRANSITION" });

  const updatedRows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "MotelBooking"
     SET "status" = $1,
         "rejectReason" = CASE WHEN $1 = 'RECHAZADA' THEN $3 ELSE "rejectReason" END,
         "rejectNote" = CASE WHEN $1 = 'RECHAZADA' THEN $4 ELSE "rejectNote" END,
         "confirmationCode" = CASE WHEN $1 = 'CONFIRMADA' AND COALESCE("confirmationCode", '') = '' THEN $5 ELSE "confirmationCode" END,
         "updatedAt" = NOW()
     WHERE id = $2::uuid
     RETURNING *`,
    nextStatus,
    id,
    rejectReason || null,
    rejectNote || null,
    randomConfirmationCode()
  );
  const updated = updatedRows[0];
  const notifyUserId = isOwner ? booking.clientId : booking.establishmentId;
  /* Al cliente lo llevamos al chat con el local, donde confirma o cancela;
     el panel del motel le daría 403. */
  const notifyUrl = isOwner ? `/chat/${booking.establishmentId}` : `/dashboard/motel?tab=bookings`;
  await prisma.notification.create({ data: { userId: notifyUserId, type: "BOOKING_UPDATE", data: { title: "Actualización de reserva", body: `Estado: ${nextStatus}`, status: nextStatus, bookingId: updated.id, url: notifyUrl } } }).catch((err) => {
    console.error("[motel] Failed to create booking action notification:", err?.message || err);
  });
  sendToUser(notifyUserId, "booking:update", { bookingId: updated.id, status: nextStatus, rejectReason: updated.rejectReason, rejectNote: updated.rejectNote });

  if (isOwner && nextStatus === "ACEPTADA") {
    await sendBookingMessage(booking.establishmentId, booking.clientId, `✅ Tu reserva fue aceptada. Precio final: $${Number(updated.priceClp || 0).toLocaleString("es-CL")}. Debes confirmarla para activarla.`);
  }
  if (isOwner && nextStatus === "RECHAZADA") {
    const reasonText = rejectReason === "CERRADO" ? "Local cerrado" : rejectReason === "SIN_HABITACIONES" ? "Sin habitaciones" : `Otro motivo: ${rejectNote}`;
    await sendBookingMessage(booking.establishmentId, booking.clientId, `❌ Reserva rechazada. Motivo: ${reasonText}.`);
  }
  if (isClient && nextStatus === "CONFIRMADA") {
    const establishment = await prisma.user.findUnique({ where: { id: booking.establishmentId }, select: { displayName: true, address: true, city: true, latitude: true, longitude: true } });
    const room = booking.roomId
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT "name" FROM "MotelRoom" WHERE id = $1::uuid LIMIT 1`, booking.roomId).then((rows) => rows[0] || null)
      : null;
    const mapsLink = mapsLinkFrom(establishment?.address, establishment?.city, establishment?.displayName || "Motel");
    const code = updated.confirmationCode || "SIN-CODIGO";
    const roomLabel = room?.name || "Habitación";
    await sendBookingMessage(booking.clientId, booking.establishmentId, `✅ El cliente confirmó la reserva para ${updated.durationType}. Código: ${code}. Inicio: ${updated.startAt ? new Date(updated.startAt).toLocaleString("es-CL") : "por confirmar"}.`);
    await sendBookingMessage(booking.establishmentId, booking.clientId, `🎫 Reserva confirmada\n• Código: ${code}\n• Estado: CONFIRMADA\n• Habitación asignada: ${roomLabel}\n• Monto final: $${Number(updated.priceClp || 0).toLocaleString("es-CL")}\n• Inicio: ${updated.startAt ? new Date(updated.startAt).toLocaleString("es-CL") : "por confirmar"}\n• Dirección: ${(establishment?.address || "Dirección por confirmar")}${establishment?.city ? `, ${establishment.city}` : ""}\n• Google Maps: ${mapsLink}`);
  }

  const bookingWithDetails = await getBookingWithDetails(updated.id);
  return res.json({ booking: bookingWithDetails || updated });
}));

motelRouter.delete("/motel/bookings/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const user = (req as any).user;
  const id = String(req.params.id);
  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MotelBooking" WHERE id = $1::uuid LIMIT 1`, id);
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: "NOT_FOUND" });

  const isOwner = isMotelOwner(user) && booking.establishmentId === userId;
  const isClient = booking.clientId === userId;
  if (!isOwner && !isClient) return res.status(403).json({ error: "FORBIDDEN" });

  const deleted = await prisma.$queryRawUnsafe<any[]>(`DELETE FROM "MotelBooking" WHERE id = $1::uuid RETURNING id`, id);
  return res.json({ ok: true, deleted: deleted.length });
}));

motelRouter.get("/motel/dashboard", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const userId = req.session.userId!;
  const owner = await loadOwnerProfile(userId);
  if (!owner) return res.status(404).json({ error: "NOT_FOUND" });

  const [rooms, promotions, bookings] = await Promise.all([
    listRooms(userId),
    listPromotions(userId),
    prisma.$queryRawUnsafe<any[]>(`SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE b."establishmentId" = $1::uuid ORDER BY b."createdAt" DESC LIMIT 200`, userId)
  ]);

  return res.json({ profile: serializeOwnerProfile(owner), rooms, promotions, bookings });
}));

motelRouter.put("/motel/dashboard/profile", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  /* Sólo se tocan los campos que vienen en el body. Antes se completaba con
     `user.<campo>`, pero `req.user` no trae esos datos. */
  const body = req.body ?? {};
  const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  const data: Record<string, unknown> = {};

  if (body.displayName !== undefined) {
    /* Los moteles usan su nombre comercial ("Intimo Hotel Barrio Brasil"):
       su tarjeta tiene espacio para 40 letras, no las 20 de un perfil. */
    const name = normalizeDisplayName(String(body.displayName ?? ""));
    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: "NAME_INVALID", message: "El nombre debe tener entre 2 y 40 caracteres." });
    }
    data.displayName = name;
  }
  if (body.address !== undefined) data.address = text(body.address, 200) || null;
  if (body.city !== undefined) data.city = text(body.city, 80) || null;
  if (body.phone !== undefined) data.phone = text(body.phone, 30) || null;
  if (body.rules !== undefined) data.bio = text(body.rules, 2000) || null;
  if (body.schedule !== undefined) data.serviceDescription = text(body.schedule, 500) || null;
  if (body.latitude !== undefined || body.longitude !== undefined) {
    const lat = body.latitude === null || body.latitude === "" ? null : Number(body.latitude);
    const lng = body.longitude === null || body.longitude === "" ? null : Number(body.longitude);
    const bothNull = lat === null && lng === null;
    const valid = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!bothNull && !valid) {
      return res.status(400).json({ error: "INVALID_COORDINATES", message: "Busca la dirección en el mapa para fijar la ubicación." });
    }
    data.latitude = lat;
    data.longitude = lng;
  }
  if (body.amenities !== undefined) data.profileTags = cleanMotelAmenities(body.amenities);
  if (typeof body.isOpen === "boolean") data.businessOpen = body.isOpen;
  if (typeof body.isPublished === "boolean") data.businessPublished = body.isPublished;

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: req.session.userId! }, data: { ...data, lastEditedAt: new Date() } });
  }
  const owner = await loadOwnerProfile(req.session.userId!);
  return res.json({ profile: owner ? serializeOwnerProfile(owner) : null });
}));

/** Valida y normaliza el body de una habitación. `partial` para el PUT. */
function parseRoomBody(body: any, partial: boolean): { data?: Record<string, any>; error?: string; message?: string } {
  const data: Record<string, any> = {};
  if (body?.name !== undefined || !partial) {
    const name = String(body?.name ?? "").trim().slice(0, 80);
    if (name.length < 2) return { error: "NAME_REQUIRED", message: "Ponle un nombre a la habitación." };
    data.name = name;
  }
  if (body?.description !== undefined) data.description = String(body.description || "").trim().slice(0, 1000) || null;
  if (body?.roomType !== undefined) data.roomType = String(body.roomType || "").trim().slice(0, 40) || null;
  if (body?.location !== undefined) data.location = String(body.location || "").trim().slice(0, 80) || null;
  if (body?.amenities !== undefined) data.amenities = cleanRoomAmenities(body.amenities);
  if (body?.photoUrls !== undefined) data.photoUrls = parseStringArray(body.photoUrls).slice(0, 12);
  for (const key of ["price3h", "price6h", "priceNight"] as const) {
    if (body?.[key] !== undefined) data[key] = toPrice(body[key]) ?? 0;
  }
  if (!partial || ["price3h", "price6h", "priceNight"].some((k) => k in data)) {
    const prices = ["price3h", "price6h", "priceNight"].map((k) => Number(data[k] ?? 0));
    const allPricesSent = ["price3h", "price6h", "priceNight"].every((k) => k in data);
    if ((!partial || allPricesSent) && prices.every((p) => p <= 0)) {
      return { error: "PRICE_REQUIRED", message: "Ingresa al menos una tarifa (3 horas, 6 horas o noche)." };
    }
    /* `price` es la columna vieja: queda con la tarifa más barata disponible. */
    const available = prices.filter((p) => p > 0);
    if (available.length) data.price = Math.min(...available);
  }
  if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return { data };
}

/** Valida y normaliza el body de una promoción. */
function parsePromoBody(body: any, partial: boolean): { data?: Record<string, any>; error?: string; message?: string } {
  const data: Record<string, any> = {};
  if (body?.title !== undefined || !partial) {
    const title = String(body?.title ?? "").trim().slice(0, 80);
    if (title.length < 2) return { error: "TITLE_REQUIRED", message: "Ponle un título a la promoción." };
    data.title = title;
  }
  if (body?.description !== undefined) data.description = String(body.description || "").trim().slice(0, 500) || null;
  if (body?.discountPercent !== undefined || body?.discountClp !== undefined || !partial) {
    const pct = toPrice(body?.discountPercent);
    const clp = toPrice(body?.discountClp);
    if (pct != null && (pct < 1 || pct > 90)) return { error: "INVALID_DISCOUNT", message: "El porcentaje debe estar entre 1 y 90." };
    if (!pct && !clp) return { error: "DISCOUNT_REQUIRED", message: "Indica un descuento en porcentaje o en pesos." };
    /* Uno u otro: si vienen ambos, manda el porcentaje. */
    data.discountPercent = pct || null;
    data.discountClp = pct ? null : clp;
  }
  const parseDate = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? "invalid" : d;
  };
  const startsAt = parseDate(body?.startsAt);
  const endsAt = parseDate(body?.endsAt);
  if (startsAt === "invalid" || endsAt === "invalid") return { error: "INVALID_DATE", message: "Revisa las fechas de la promoción." };
  if (startsAt instanceof Date && endsAt instanceof Date && endsAt <= startsAt) {
    return { error: "INVALID_DATE_RANGE", message: "La fecha de término debe ser posterior al inicio." };
  }
  if (startsAt !== undefined) data.startsAt = startsAt;
  if (endsAt !== undefined) data.endsAt = endsAt;
  if (body?.roomIds !== undefined) {
    data.roomIds = Array.isArray(body.roomIds) ? body.roomIds.map((id: any) => String(id)).filter(isUuid) : [];
    data.roomId = data.roomIds[0] || null;
  }
  if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return { data };
}

motelRouter.post("/motel/dashboard/rooms", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = parseRoomBody(req.body, false);
  if (!parsed.data) return res.status(400).json({ error: parsed.error, message: parsed.message });
  const room = await prisma.motelRoom.create({
    data: {
      establishmentId: req.session.userId!,
      name: parsed.data.name,
      price: parsed.data.price ?? 0,
      description: parsed.data.description ?? null,
      roomType: parsed.data.roomType ?? null,
      location: parsed.data.location ?? null,
      amenities: parsed.data.amenities ?? [],
      photoUrls: parsed.data.photoUrls ?? [],
      price3h: parsed.data.price3h ?? 0,
      price6h: parsed.data.price6h ?? 0,
      priceNight: parsed.data.priceNight ?? 0,
      isActive: parsed.data.isActive ?? true,
    },
  });
  await touchEdited(req.session.userId!);
  return res.json({ room });
}));

motelRouter.put("/motel/dashboard/rooms/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const id = String(req.params.id);
  if (!isUuid(id)) return res.status(404).json({ error: "NOT_FOUND" });

  const parsed = parseRoomBody(req.body, true);
  if (!parsed.data) return res.status(400).json({ error: parsed.error, message: parsed.message });
  const updated = await prisma.motelRoom.updateMany({
    where: { id, establishmentId: req.session.userId! },
    data: parsed.data,
  });
  if (!updated.count) return res.status(404).json({ error: "NOT_FOUND" });
  await touchEdited(req.session.userId!);
  return res.json({ ok: true, updated: updated.count });
}));

motelRouter.post("/motel/dashboard/room-photos", roomPhotoUpload.array("files", 10), asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!isMotelOwner(user)) {
    await Promise.all(files.map((f) => unlink(f.path).catch(() => {})));
    return res.status(403).json({ error: "FORBIDDEN" });
  }
  if (!files.length) return res.status(400).json({ error: "NO_FILES", message: "Elige al menos una foto." });
  const urls: string[] = [];
  const failures: string[] = [];
  for (const file of files) {
    try {
      await validateUploadedFile(file, "image");
      const finalName = await optimizeUploadedImage(file, "gallery");
      urls.push(storageProvider.publicUrl(finalName));
    } catch {
      await unlink(file.path).catch(() => {});
      failures.push(file.originalname);
    }
  }
  if (!urls.length) {
    return res.status(400).json({ error: "UPLOAD_FAILED", message: "No pudimos procesar las fotos. Prueba con JPG o PNG." });
  }
  return res.json({ urls, failures });
}));

motelRouter.post("/motel/dashboard/promotions", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = parsePromoBody(req.body, false);
  if (!parsed.data) return res.status(400).json({ error: parsed.error, message: parsed.message });
  const promotion = await prisma.motelPromotion.create({
    data: {
      establishmentId: req.session.userId!,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      discountPercent: parsed.data.discountPercent ?? null,
      discountClp: parsed.data.discountClp ?? null,
      startsAt: parsed.data.startsAt ?? null,
      endsAt: parsed.data.endsAt ?? null,
      roomIds: parsed.data.roomIds ?? [],
      roomId: parsed.data.roomId ?? null,
      isActive: parsed.data.isActive ?? true,
    },
  });
  await touchEdited(req.session.userId!);
  return res.json({ promotion });
}));

motelRouter.put("/motel/dashboard/promotions/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const id = String(req.params.id);
  if (!isUuid(id)) return res.status(404).json({ error: "NOT_FOUND" });

  const parsed = parsePromoBody(req.body, true);
  if (!parsed.data) return res.status(400).json({ error: parsed.error, message: parsed.message });
  const updated = await prisma.motelPromotion.updateMany({
    where: { id, establishmentId: req.session.userId! },
    data: parsed.data,
  });
  if (!updated.count) return res.status(404).json({ error: "NOT_FOUND" });
  await touchEdited(req.session.userId!);
  return res.json({ ok: true, updated: updated.count });
}));

motelRouter.delete("/motel/dashboard/rooms/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const id = String(req.params.id);
  await prisma.$executeRawUnsafe(`DELETE FROM "MotelPromotion" WHERE "establishmentId" = $1::uuid AND ("roomId" = $2::uuid OR $2::uuid = ANY("roomIds"))`, req.session.userId!, id);
  const rows = await prisma.$queryRawUnsafe<any[]>(`DELETE FROM "MotelRoom" WHERE id = $1::uuid AND "establishmentId" = $2::uuid RETURNING id`, id, req.session.userId!);
  if (rows.length) await touchEdited(req.session.userId!);
  return res.json({ ok: true, deleted: rows.length });
}));

motelRouter.delete("/motel/dashboard/promotions/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const rows = await prisma.$queryRawUnsafe<any[]>(`DELETE FROM "MotelPromotion" WHERE id = $1::uuid AND "establishmentId" = $2::uuid RETURNING id`, String(req.params.id), req.session.userId!);
  if (rows.length) await touchEdited(req.session.userId!);
  return res.json({ ok: true, deleted: rows.length });
}));
