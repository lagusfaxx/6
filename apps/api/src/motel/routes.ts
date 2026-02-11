import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { sendToUser } from "../realtime/sse";

export const motelRouter = Router();

let schemaReady = false;
async function ensureMotelSchema() {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MotelBooking" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "establishmentId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "roomId" UUID NULL REFERENCES "MotelRoom"("id") ON DELETE SET NULL,
      "clientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
      "durationType" TEXT NOT NULL,
      "priceClp" INTEGER NOT NULL,
      "startAt" TIMESTAMP NULL,
      "note" TEXT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "MotelBooking_establishmentId_idx" ON "MotelBooking" ("establishmentId");
    CREATE INDEX IF NOT EXISTS "MotelBooking_clientId_idx" ON "MotelBooking" ("clientId");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "roomType" TEXT;
    ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "price3h" INTEGER;
    ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "price6h" INTEGER;
    ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "priceNight" INTEGER;
    ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "discountClp" INTEGER;
    ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "roomId" UUID;
  `);

  schemaReady = true;
}

function isMotelOwner(user: any) {
  if (!user) return false;
  const role = String(user.role || "").toUpperCase();
  const profileType = String(user.profileType || "").toUpperCase();
  return profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

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
    where: { profileType: "ESTABLISHMENT", isActive: true },
    select: {
      id: true, username: true, displayName: true, city: true, address: true,
      latitude: true, longitude: true, coverUrl: true,
      category: { select: { slug: true, displayName: true, name: true } },
      media: { where: { type: "IMAGE" }, take: 4, orderBy: { createdAt: "desc" }, select: { url: true } },
      motelRooms: { where: { isActive: true }, select: { id: true, roomType: true, amenities: true, price: true, price3h: true, price6h: true, priceNight: true } },
      motelPromotions: { where: { isActive: true }, select: { id: true } }
    },
    take: 300
  });

  const reviewRows = await prisma.establishmentReview.groupBy({ by: ["establishmentId"], _avg: { stars: true }, _count: { _all: true } });
  const reviewMap = new Map(reviewRows.map((r) => [r.establishmentId, { rating: r._avg.stars ?? null, reviews: r._count._all }]));

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
    const categoryName = `${u.category?.slug || ""} ${u.category?.displayName || ""} ${u.category?.name || ""}`.toLowerCase();
    const isHotel = categoryName.includes("hotel");
    const distance = lat != null && lng != null && u.latitude != null && u.longitude != null ? toDistance(lat, lng, u.latitude, u.longitude) : null;
    const firstRoom = u.motelRooms[0] as any;
    const fromPrice = duration === "6H" ? Number(firstRoom?.price6h || firstRoom?.price || 0) : duration === "NIGHT" ? Number(firstRoom?.priceNight || firstRoom?.price || 0) : Number(firstRoom?.price3h || firstRoom?.price || 0);

    const tags = new Set<string>();
    u.motelRooms.forEach((r: any) => {
      (r.amenities || []).forEach((a: string) => tags.add(a));
      if ((r.roomType || "").toLowerCase().includes("jacuzzi")) tags.add("Jacuzzi");
    });
    if (u.motelPromotions.length) tags.add("Promo");

    return {
      id: u.id,
      name: u.displayName || u.username,
      address: u.address,
      city: u.city,
      latitude: u.latitude,
      longitude: u.longitude,
      distance,
      rating: reviewMap.get(u.id)?.rating ? Number((reviewMap.get(u.id)?.rating || 0).toFixed(2)) : null,
      reviewsCount: reviewMap.get(u.id)?.reviews || 0,
      fromPrice,
      coverUrl: u.coverUrl || u.media[0]?.url || null,
      tags: Array.from(tags).slice(0, 5),
      hasPromo: u.motelPromotions.length > 0,
      category: isHotel ? "HOTEL" : "MOTEL"
    };
  })
  .filter((u) => (category === "hotel" ? u.category === "HOTEL" : category === "motel" ? u.category === "MOTEL" : true))
  .filter((u) => (search ? `${u.city} ${u.address} ${u.name}`.toLowerCase().includes(search) : true))
  .filter((u) => (u.distance != null ? u.distance <= rangeKm : true))
  .filter((u) => (onlyPromos ? u.hasPromo : true))
  .filter((u) => (priceMax ? u.fromPrice <= priceMax : true))
  .filter((u) => (minRating != null ? (u.rating || 0) >= minRating : true))
  .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({ establishments: mapped });
}));

motelRouter.get("/motels/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const id = String(req.params.id);
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, displayName: true, address: true, city: true, phone: true,
      bio: true, serviceDescription: true, coverUrl: true,
      media: { where: { type: "IMAGE" }, take: 16, orderBy: { createdAt: "desc" }, select: { url: true } },
      motelRooms: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
      motelPromotions: { where: { isActive: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });

  const reviews = await prisma.establishmentReview.groupBy({ by: ["establishmentId"], where: { establishmentId: id }, _avg: { stars: true }, _count: { _all: true } });
  const rating = reviews[0]?._avg.stars ? Number((reviews[0]._avg.stars || 0).toFixed(2)) : null;

  return res.json({ establishment: { id: u.id, name: u.displayName || u.username, address: u.address, city: u.city, phone: u.phone, rules: u.bio, schedule: u.serviceDescription, coverUrl: u.coverUrl, rating, reviewsCount: reviews[0]?._count._all || 0, gallery: u.media.map((m) => m.url), rooms: u.motelRooms, promotions: u.motelPromotions } });
}));

motelRouter.post("/motels/:id/bookings", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const clientId = req.session.userId;
  if (!clientId) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const establishmentId = String(req.params.id);
  const roomId = req.body?.roomId ? String(req.body.roomId) : null;
  const durationType = String(req.body?.durationType || "3H").toUpperCase();
  const startAt = req.body?.startAt ? new Date(req.body.startAt) : null;
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;

  const room = roomId ? await prisma.motelRoom.findFirst({ where: { id: roomId, establishmentId, isActive: true } }) : null;
  const fallbackRoom = room || await prisma.motelRoom.findFirst({ where: { establishmentId, isActive: true }, orderBy: { createdAt: "asc" } });
  if (!fallbackRoom) return res.status(400).json({ error: "NO_ROOMS" });

  const fallbackAny = fallbackRoom as any;
  const priceClp = durationType === "6H" ? Number(fallbackAny.price6h || fallbackRoom.price) : durationType === "NIGHT" ? Number(fallbackAny.priceNight || fallbackRoom.price) : Number(fallbackAny.price3h || fallbackRoom.price);

  const rows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO "MotelBooking" ("establishmentId", "roomId", "clientId", "status", "durationType", "priceClp", "startAt", "note") VALUES ($1, $2, $3, 'PENDIENTE', $4, $5, $6, $7) RETURNING *`, establishmentId, fallbackRoom.id, clientId, durationType, priceClp, startAt, note);
  const booking = rows[0];
  await prisma.notification.create({ data: { userId: establishmentId, type: "SERVICE_PUBLISHED", title: "Nueva reserva pendiente", body: `Tienes una solicitud ${durationType}` } });
  sendToUser(establishmentId, "booking:new", { bookingId: booking.id });

  return res.json({ booking });
}));

motelRouter.get("/motel/bookings", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const isOwner = isMotelOwner((req as any).user);

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE ${isOwner ? 'b."establishmentId" = $1' : 'b."clientId" = $1'} ORDER BY b."createdAt" DESC LIMIT 300`, userId);
  return res.json({ bookings: rows });
}));

motelRouter.post("/motel/bookings/:id/action", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const user = (req as any).user;
  const id = String(req.params.id);
  const action = String(req.body?.action || "").toUpperCase();

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MotelBooking" WHERE id = $1 LIMIT 1`, id);
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: "NOT_FOUND" });

  const isOwner = isMotelOwner(user) && booking.establishmentId === userId;
  const isClient = booking.clientId === userId;
  let nextStatus: string | null = null;
  if (isOwner && action === "ACCEPT" && booking.status === "PENDIENTE") nextStatus = "CONFIRMADA";
  if (isOwner && action === "REJECT" && booking.status === "PENDIENTE") nextStatus = "RECHAZADA";
  if (isOwner && action === "FINISH" && booking.status === "CONFIRMADA") nextStatus = "FINALIZADA";
  if (isClient && action === "CANCEL" && ["PENDIENTE", "CONFIRMADA"].includes(booking.status)) nextStatus = "CANCELADA_CLIENTE";
  if (!nextStatus) return res.status(400).json({ error: "INVALID_TRANSITION" });

  const updatedRows = await prisma.$queryRawUnsafe<any[]>(`UPDATE "MotelBooking" SET "status" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *`, nextStatus, id);
  const updated = updatedRows[0];
  const notifyUserId = isOwner ? booking.clientId : booking.establishmentId;
  await prisma.notification.create({ data: { userId: notifyUserId, type: "SERVICE_PUBLISHED", title: "Actualización de reserva", body: `Estado: ${nextStatus}` } });
  sendToUser(notifyUserId, "booking:update", { bookingId: updated.id, status: nextStatus });

  return res.json({ booking: updated });
}));

motelRouter.get("/motel/dashboard", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const userId = req.session.userId!;

  const [rooms, promotions, bookings] = await Promise.all([
    prisma.motelRoom.findMany({ where: { establishmentId: userId }, orderBy: { createdAt: "desc" } }),
    prisma.motelPromotion.findMany({ where: { establishmentId: userId }, orderBy: { createdAt: "desc" } }),
    prisma.$queryRawUnsafe<any[]>(`SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE b."establishmentId" = $1 ORDER BY b."createdAt" DESC LIMIT 200`, userId)
  ]);

  return res.json({ profile: { id: user.id, displayName: user.displayName, address: user.address, phone: user.phone, city: user.city, latitude: user.latitude, longitude: user.longitude, coverUrl: user.coverUrl, rules: user.bio, schedule: user.serviceDescription }, rooms, promotions, bookings });
}));

motelRouter.put("/motel/dashboard/profile", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const updated = await prisma.user.update({
    where: { id: req.session.userId! },
    data: {
      displayName: req.body?.displayName != null ? String(req.body.displayName) : user.displayName,
      address: req.body?.address != null ? String(req.body.address) : user.address,
      city: req.body?.city != null ? String(req.body.city) : user.city,
      phone: req.body?.phone != null ? String(req.body.phone) : user.phone,
      latitude: req.body?.latitude != null ? Number(req.body.latitude) : user.latitude,
      longitude: req.body?.longitude != null ? Number(req.body.longitude) : user.longitude,
      bio: req.body?.rules != null ? String(req.body.rules) : user.bio,
      serviceDescription: req.body?.schedule != null ? String(req.body.schedule) : user.serviceDescription
    }
  });

  return res.json({ profile: updated });
}));

motelRouter.post("/motel/dashboard/rooms", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const room = await prisma.motelRoom.create({
    data: {
      establishmentId: req.session.userId!,
      name: String(req.body?.name || "Suite"),
      description: req.body?.description ? String(req.body.description) : null,
      price: Number(req.body?.price3h || req.body?.price || 0),
      roomType: req.body?.roomType ? String(req.body.roomType) : null,
      amenities: parseStringArray(req.body?.amenities),
      photoUrls: parseStringArray(req.body?.photoUrls),
      price3h: Number(req.body?.price3h || 0),
      price6h: Number(req.body?.price6h || 0),
      priceNight: Number(req.body?.priceNight || 0)
    } as any
  });

  return res.json({ room });
}));

motelRouter.put("/motel/dashboard/rooms/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const updated = await prisma.motelRoom.updateMany({
    where: { id: String(req.params.id), establishmentId: req.session.userId! },
    data: {
      name: req.body?.name != null ? String(req.body.name) : undefined,
      description: req.body?.description != null ? String(req.body.description) : undefined,
      roomType: req.body?.roomType != null ? String(req.body.roomType) : undefined,
      amenities: req.body?.amenities ? parseStringArray(req.body.amenities) : undefined,
      photoUrls: req.body?.photoUrls ? parseStringArray(req.body.photoUrls) : undefined,
      price: req.body?.price3h != null ? Number(req.body.price3h) : undefined,
      price3h: req.body?.price3h != null ? Number(req.body.price3h) : undefined,
      price6h: req.body?.price6h != null ? Number(req.body.price6h) : undefined,
      priceNight: req.body?.priceNight != null ? Number(req.body.priceNight) : undefined,
      isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : undefined
    } as any
  });

  return res.json({ ok: true, updated: updated.count });
}));

motelRouter.post("/motel/dashboard/promotions", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const promotion = await prisma.motelPromotion.create({
    data: {
      establishmentId: req.session.userId!,
      title: String(req.body?.title || "Promo"),
      description: req.body?.description ? String(req.body.description) : null,
      discountPercent: req.body?.discountPercent != null ? Number(req.body.discountPercent) : null,
      discountClp: req.body?.discountClp != null ? Number(req.body.discountClp) : null,
      startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : null,
      endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null,
      isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : true,
      roomId: req.body?.roomId ? String(req.body.roomId) : null
    } as any
  });

  return res.json({ promotion });
}));

motelRouter.put("/motel/dashboard/promotions/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const updated = await prisma.motelPromotion.updateMany({
    where: { id: String(req.params.id), establishmentId: req.session.userId! },
    data: {
      title: req.body?.title != null ? String(req.body.title) : undefined,
      description: req.body?.description != null ? String(req.body.description) : undefined,
      discountPercent: req.body?.discountPercent != null ? Number(req.body.discountPercent) : undefined,
      discountClp: req.body?.discountClp != null ? Number(req.body.discountClp) : undefined,
      startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : undefined,
      endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : undefined,
      isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : undefined,
      roomId: req.body?.roomId != null ? String(req.body.roomId) : undefined
    } as any
  });

  return res.json({ ok: true, updated: updated.count });
}));
